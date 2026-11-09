import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { pool } from "../db/pool";
import {
  getContractByNumberAndToken,
  reissueContractViewToken,
  VIEW_TOKEN_VALID_DAYS,
} from "./admin-contract.service";

const contractNumber = `CT-VIEWTOKEN-${Date.now()}`;

async function insertContract(issuedDaysAgo: number): Promise<number> {
  const result = await pool.query<{ id: number }>(
    `INSERT INTO contracts (contract_number, customer_name, customer_phone, customer_address,
       product_name, contract_amount, contract_start_date, contract_end_date, signature_name,
       payload, view_token, view_token_issued_at)
     VALUES ($1, '테스트', '010-0000-0000', '주소', '상품', 1000, CURRENT_DATE, CURRENT_DATE, '테스트',
       '{}'::jsonb, 'old-token', NOW() - make_interval(days => $2))
     RETURNING id`,
    [contractNumber, issuedDaysAgo],
  );
  return result.rows[0].id;
}

describe("고객용 링크 유효기간", () => {
  afterAll(async () => {
    await pool.query("DELETE FROM contracts WHERE contract_number = $1", [contractNumber]);
  });

  it("기간이 지나면 expired, 재발급하면 새 토큰만 열리고 이전 토큰은 막힌다", async () => {
    const id = await insertContract(VIEW_TOKEN_VALID_DAYS + 1);

    expect(await getContractByNumberAndToken(contractNumber, "old-token")).toBe("expired");

    const reissued = await reissueContractViewToken(id);
    expect(reissued).not.toBeNull();

    const fresh = await getContractByNumberAndToken(contractNumber, reissued!.viewToken);
    expect(fresh).not.toBeNull();
    expect(fresh).not.toBe("expired");
    expect(await getContractByNumberAndToken(contractNumber, "old-token")).toBeNull();
  });
});
