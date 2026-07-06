import type { PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";
import {
  formatContractNumber,
  formatDatePrefix,
  generateContractNumber,
  getNextContractSequence,
  isUniqueViolation,
  withContractNumberRetry,
} from "./contract-number";

function createMockClient(
  rows: Array<{ contract_number: string }>,
): PoolClient {
  return {
    query: vi.fn().mockResolvedValue({
      rows,
      rowCount: rows.length,
    }),
  } as unknown as PoolClient;
}

describe("formatContractNumber", () => {
  it("formats the first contract number of the day", () => {
    expect(formatContractNumber("20260624", 1)).toBe("CT-20260624-0001");
  });

  it("formats the second contract number of the day", () => {
    expect(formatContractNumber("20260624", 2)).toBe("CT-20260624-0002");
  });

  it("resets sequence when the date prefix changes", () => {
    expect(formatContractNumber("20260625", 1)).toBe("CT-20260625-0001");
  });
});

describe("formatDatePrefix", () => {
  it("returns YYYYMMDD in Asia/Seoul timezone", () => {
    const date = new Date("2026-06-24T15:00:00.000Z");
    expect(formatDatePrefix(date)).toBe("20260625");
  });
});

describe("getNextContractSequence", () => {
  it("returns 1 when no contracts exist for the date", async () => {
    const client = createMockClient([]);
    await expect(getNextContractSequence(client, "20260624")).resolves.toBe(1);
  });

  it("returns next sequence for the same date", async () => {
    const client = createMockClient([{ contract_number: "CT-20260624-0001" }]);
    await expect(getNextContractSequence(client, "20260624")).resolves.toBe(2);
  });

  it("starts from 1 again for a different date", async () => {
    const client = createMockClient([]);
    await expect(getNextContractSequence(client, "20260625")).resolves.toBe(1);
  });
});

describe("generateContractNumber", () => {
  it("generates the first contract number for a given date", async () => {
    const client = createMockClient([]);
    const date = new Date("2026-06-24T01:00:00.000Z");

    await expect(generateContractNumber(client, date)).resolves.toBe(
      "CT-20260624-0001",
    );
  });

  it("generates the second contract number for the same date", async () => {
    const client = createMockClient([{ contract_number: "CT-20260624-0001" }]);
    const date = new Date("2026-06-24T01:00:00.000Z");

    await expect(generateContractNumber(client, date)).resolves.toBe(
      "CT-20260624-0002",
    );
  });
});

describe("withContractNumberRetry", () => {
  it("retries when a unique violation occurs", async () => {
    const client = createMockClient([]);
    const operation = vi
      .fn()
      .mockRejectedValueOnce({ code: "23505" })
      .mockResolvedValueOnce({ id: 1 });

    const result = await withContractNumberRetry(client, operation, 2);

    expect(result).toEqual({ id: 1 });
    expect(operation).toHaveBeenCalledTimes(2);
  });
});

describe("isUniqueViolation", () => {
  it("detects PostgreSQL unique violations", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation(new Error("other"))).toBe(false);
  });
});
