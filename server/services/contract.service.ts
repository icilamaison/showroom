import { randomBytes } from "crypto";
import { pool } from "../db/pool";
import type { ContractInput } from "../schemas/contract.schema";
import { withContractNumberRetry } from "./contract-number";

export type CreateContractResult = {
  contractNumber: string;
  viewToken: string;
  status: "SUBMITTED";
};

function buildPayload(input: ContractInput, rawPayload: unknown): string {
  return JSON.stringify({
    ...(typeof rawPayload === "object" && rawPayload !== null ? rawPayload : {}),
    writtenDate: input.writtenDate,
    agreementDate: input.agreementDate,
  });
}

export async function createContract(
  input: ContractInput,
  rawPayload: unknown,
  adminId: number,
): Promise<CreateContractResult> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const viewToken = randomBytes(24).toString("hex");

    const result = await withContractNumberRetry(client, async (contractNumber) => {
      await client.query(
        `INSERT INTO contracts (
          contract_number,
          customer_name,
          customer_phone,
          customer_address,
          product_name,
          contract_amount,
          contract_start_date,
          contract_end_date,
          special_terms,
          terms_agreed,
          signature_name,
          status,
          payload,
          view_token,
          admin_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15
        )`,
        [
          contractNumber,
          input.customerName,
          input.customerPhone,
          input.customerAddress,
          input.productName,
          input.contractAmount,
          input.contractStartDate,
          input.contractEndDate,
          input.specialTerms || null,
          input.termsAgreed,
          input.signatureName,
          "SUBMITTED",
          buildPayload(input, rawPayload),
          viewToken,
          adminId,
        ],
      );

      return {
        contractNumber,
        viewToken,
        status: "SUBMITTED" as const,
      };
    });

    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type UpdateContractResult = "updated" | "not_found";

// 작성 후 오타 수정. 고객 서명은 그대로 두고 수정 전후 내용을 contract_edits에 남긴다.
export async function updateContract(
  id: number,
  input: ContractInput,
  rawPayload: unknown,
  adminId: number,
): Promise<UpdateContractResult> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const current = await client.query<{ payload: unknown }>(
      "SELECT payload FROM contracts WHERE id = $1 FOR UPDATE",
      [id],
    );

    if (!current.rowCount) {
      await client.query("ROLLBACK");
      return "not_found";
    }

    const payload = buildPayload(input, rawPayload);

    await client.query(
      `UPDATE contracts SET
         customer_name = $2,
         customer_phone = $3,
         customer_address = $4,
         product_name = $5,
         contract_amount = $6,
         contract_start_date = $7,
         contract_end_date = $8,
         special_terms = $9,
         terms_agreed = $10,
         signature_name = $11,
         payload = $12::jsonb,
         updated_at = NOW()
       WHERE id = $1`,
      [
        id,
        input.customerName,
        input.customerPhone,
        input.customerAddress,
        input.productName,
        input.contractAmount,
        input.contractStartDate,
        input.contractEndDate,
        input.specialTerms || null,
        input.termsAgreed,
        input.signatureName,
        payload,
      ],
    );

    await client.query(
      `INSERT INTO contract_edits (contract_id, admin_id, before_payload, after_payload)
       VALUES ($1, $2, $3::jsonb, $4::jsonb)`,
      [id, adminId, JSON.stringify(current.rows[0].payload ?? {}), payload],
    );

    await client.query("COMMIT");
    return "updated";
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
