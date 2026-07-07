import { describe, expect, it } from "vitest";
import { parseContractListQuery } from "./contract-list-query";

describe("parseContractListQuery", () => {
  it("parses list filters from query params", () => {
    const result = parseContractListQuery({
      customerName: "홍길동",
      dateFrom: "2026-07-01",
      dateTo: "2026-07-07",
      page: "2",
      limit: "20",
    });

    expect(result.error).toBeUndefined();
    expect(result.filters).toEqual({
      customerName: "홍길동",
      customerPhone: undefined,
      status: undefined,
      dateFrom: "2026-07-01",
      dateTo: "2026-07-07",
      page: 2,
      limit: 20,
    });
  });

  it("rejects invalid date range", () => {
    const result = parseContractListQuery({
      dateFrom: "2026-07-10",
      dateTo: "2026-07-01",
    });

    expect(result.error).toBe("시작일은 종료일보다 늦을 수 없습니다.");
  });
});
