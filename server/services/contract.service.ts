import { randomBytes } from "crypto";
import { pool } from "../db/pool";
import type { ContractInput } from "../schemas/contract.schema";
import { withContractNumberRetry } from "./contract-number";

export type CreateContractResult = {
  contractNumber: string;
  viewToken: string;
  status: "SUBMITTED";
};

export async function createContract(
  input: ContractInput,
  rawPayload: unknown,
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
          view_token
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14
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
          JSON.stringify({
            ...(typeof rawPayload === "object" && rawPayload !== null
              ? rawPayload
              : {}),
            writtenDate: input.writtenDate,
            agreementDate: input.agreementDate,
          }),
          viewToken,
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
