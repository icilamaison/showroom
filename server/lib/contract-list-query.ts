import type { ContractListFilters } from "../services/admin-contract.service";

const DATE_FILTER_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function parseContractListQuery(query: Record<string, unknown>): {
  filters: ContractListFilters;
  error?: string;
} {
  const filters: ContractListFilters = {
    customerName:
      typeof query.customerName === "string" ? query.customerName : undefined,
    customerPhone:
      typeof query.customerPhone === "string" ? query.customerPhone : undefined,
    status: typeof query.status === "string" ? query.status : undefined,
    dateFrom: typeof query.dateFrom === "string" ? query.dateFrom : undefined,
    dateTo: typeof query.dateTo === "string" ? query.dateTo : undefined,
  };

  if (filters.dateFrom && !DATE_FILTER_REGEX.test(filters.dateFrom)) {
    return { filters, error: "시작일은 YYYY-MM-DD 형식이어야 합니다." };
  }

  if (filters.dateTo && !DATE_FILTER_REGEX.test(filters.dateTo)) {
    return { filters, error: "종료일은 YYYY-MM-DD 형식이어야 합니다." };
  }

  if (
    filters.dateFrom &&
    filters.dateTo &&
    filters.dateFrom > filters.dateTo
  ) {
    return { filters, error: "시작일은 종료일보다 늦을 수 없습니다." };
  }

  const page = query.page ? Number(query.page) : undefined;
  const limit = query.limit ? Number(query.limit) : undefined;

  if (Number.isFinite(page)) {
    filters.page = page;
  }

  if (Number.isFinite(limit)) {
    filters.limit = limit;
  }

  return { filters };
}
