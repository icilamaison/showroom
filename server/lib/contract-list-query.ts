import type { ContractListFilters } from "../services/admin-contract.service";

const DATE_FILTER_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_EXPORT_IDS = 5000;

function parseIds(value: unknown): number[] | undefined {
  const parts: string[] = [];

  if (typeof value === "string") {
    parts.push(...value.split(","));
  } else if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") {
        parts.push(...item.split(","));
      } else if (typeof item === "number") {
        parts.push(String(item));
      }
    }
  } else {
    return undefined;
  }

  const ids = [
    ...new Set(
      parts
        .map((part) => Number(part.trim()))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];

  return ids.length > 0 ? ids : undefined;
}

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
    ids: parseIds(query.ids),
  };

  if (filters.ids && filters.ids.length > MAX_EXPORT_IDS) {
    return {
      filters,
      error: `한 번에 최대 ${MAX_EXPORT_IDS}건까지 선택할 수 있습니다.`,
    };
  }

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
