import { timingSafeEqual } from "crypto";
import { pool } from "../db/pool";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_EXPORT_LIMIT = 5000;

export type ContractListFilters = {
  customerName?: string;
  customerPhone?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
};

export type ContractListItem = {
  id: number;
  contractNumber: string;
  customerName: string;
  customerPhone: string;
  productName: string;
  contractAmount: number;
  status: string;
  createdAt: string;
};

export type ContractListResult = {
  items: ContractListItem[];
  page: number;
  limit: number;
  total: number;
};

export type ContractDetail = {
  id: number;
  contractNumber: string;
  viewToken?: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  productName: string;
  contractAmount: number;
  contractStartDate: string;
  contractEndDate: string;
  specialTerms: string | null;
  termsAgreed: boolean;
  signatureName: string;
  status: string;
  payload: unknown;
  createdAt: string;
  updatedAt: string;
  createdByUsername: string | null;
  createdByName: string | null;
};

type ContractListRow = {
  id: number;
  contract_number: string;
  customer_name: string;
  customer_phone: string;
  product_name: string;
  contract_amount: string;
  status: string;
  created_at: Date;
};

type ContractDetailRow = {
  id: number;
  contract_number: string;
  view_token?: string | null;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  product_name: string;
  contract_amount: string;
  contract_start_date: Date;
  contract_end_date: Date;
  special_terms: string | null;
  terms_agreed: boolean;
  signature_name: string;
  status: string;
  payload: unknown;
  created_at: Date;
  updated_at: Date;
  created_by_username?: string | null;
  created_by_name?: string | null;
};

function normalizePagination(page?: number, limit?: number) {
  const normalizedPage =
    Number.isFinite(page) && page! > 0 ? Math.floor(page!) : DEFAULT_PAGE;
  const normalizedLimit =
    Number.isFinite(limit) && limit! > 0
      ? Math.min(Math.floor(limit!), MAX_LIMIT)
      : DEFAULT_LIMIT;

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    offset: (normalizedPage - 1) * normalizedLimit,
  };
}

function buildListQuery(filters: ContractListFilters) {
  const conditions: string[] = [];
  const values: Array<string> = [];

  if (filters.customerName?.trim()) {
    values.push(`%${filters.customerName.trim()}%`);
    conditions.push(`customer_name ILIKE $${values.length}`);
  }

  if (filters.customerPhone?.trim()) {
    values.push(`%${filters.customerPhone.trim()}%`);
    conditions.push(`customer_phone ILIKE $${values.length}`);
  }

  if (filters.status?.trim()) {
    values.push(filters.status.trim());
    conditions.push(`status = $${values.length}`);
  }

  if (filters.dateFrom?.trim()) {
    values.push(filters.dateFrom.trim());
    conditions.push(
      `(created_at AT TIME ZONE 'Asia/Seoul')::date >= $${values.length}::date`,
    );
  }

  if (filters.dateTo?.trim()) {
    values.push(filters.dateTo.trim());
    conditions.push(
      `(created_at AT TIME ZONE 'Asia/Seoul')::date <= $${values.length}::date`,
    );
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return { whereClause, values };
}

function mapListItem(row: ContractListRow): ContractListItem {
  return {
    id: row.id,
    contractNumber: row.contract_number,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    productName: row.product_name,
    contractAmount: Number(row.contract_amount),
    status: row.status,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listContracts(
  filters: ContractListFilters = {},
): Promise<ContractListResult> {
  const { page, limit, offset } = normalizePagination(
    filters.page,
    filters.limit,
  );
  const { whereClause, values } = buildListQuery(filters);

  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM contracts ${whereClause}`,
    values,
  );

  const listValues = [...values, limit, offset];
  const limitParamIndex = values.length + 1;
  const offsetParamIndex = values.length + 2;

  const listResult = await pool.query<ContractListRow>(
    `SELECT
       id,
       contract_number,
       customer_name,
       customer_phone,
       product_name,
       contract_amount,
       status,
       created_at
     FROM contracts
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${limitParamIndex}
     OFFSET $${offsetParamIndex}`,
    listValues,
  );

  return {
    items: listResult.rows.map(mapListItem),
    page,
    limit,
    total: Number(countResult.rows[0]?.total ?? 0),
  };
}

const CONTRACT_DETAIL_SELECT = `
  id,
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
  created_at,
  updated_at
`;

export async function listContractsForExport(
  filters: Omit<ContractListFilters, "page" | "limit"> = {},
): Promise<ContractDetail[]> {
  const { whereClause, values } = buildListQuery(filters);

  const result = await pool.query<ContractDetailRow>(
    `SELECT ${CONTRACT_DETAIL_SELECT}
     FROM contracts
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT ${MAX_EXPORT_LIMIT}`,
    values,
  );

  return result.rows.map(mapContractDetail);
}

function formatDateValue(value: Date): string {
  return value.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

function mapContractDetail(row: ContractDetailRow): ContractDetail {
  return {
    id: row.id,
    contractNumber: row.contract_number,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerAddress: row.customer_address,
    productName: row.product_name,
    contractAmount: Number(row.contract_amount),
    contractStartDate: formatDateValue(row.contract_start_date),
    contractEndDate: formatDateValue(row.contract_end_date),
    specialTerms: row.special_terms,
    termsAgreed: row.terms_agreed,
    signatureName: row.signature_name,
    status: row.status,
    payload: row.payload,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    createdByUsername: row.created_by_username ?? null,
    createdByName: row.created_by_name ?? null,
  };
}

export async function getContractById(
  id: number,
): Promise<ContractDetail | null> {
  const result = await pool.query<ContractDetailRow>(
    `SELECT
       contracts.id,
       contracts.contract_number,
       contracts.view_token,
       contracts.customer_name,
       contracts.customer_phone,
       contracts.customer_address,
       contracts.product_name,
       contracts.contract_amount,
       contracts.contract_start_date,
       contracts.contract_end_date,
       contracts.special_terms,
       contracts.terms_agreed,
       contracts.signature_name,
       contracts.status,
       contracts.payload,
       contracts.created_at,
       contracts.updated_at,
       admins.username AS created_by_username,
       admins.name AS created_by_name
     FROM contracts
     LEFT JOIN admins ON admins.id = contracts.admin_id
     WHERE contracts.id = $1`,
    [id],
  );

  if (!result.rowCount) {
    return null;
  }

  return {
    ...mapContractDetail(result.rows[0]),
    viewToken: result.rows[0].view_token ?? null,
  };
}

export async function getContractByNumberAndToken(
  contractNumber: string,
  token: string,
): Promise<ContractDetail | null> {
  const result = await pool.query<ContractDetailRow & { view_token: string | null }>(
    `SELECT
       id,
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
       created_at,
       updated_at,
       view_token
     FROM contracts
     WHERE contract_number = $1`,
    [contractNumber],
  );

  if (!result.rowCount) {
    return null;
  }

  const row = result.rows[0];
  const storedToken = row.view_token;

  // 토큰 없는(구버전) 계약서는 조회 링크 자체가 발급되지 않았으므로 항상 거부
  if (!storedToken || !isTokenMatch(storedToken, token)) {
    return null;
  }

  return mapContractDetail(row);
}

function isTokenMatch(stored: string, provided: string): boolean {
  const storedBuffer = Buffer.from(stored);
  const providedBuffer = Buffer.from(provided);

  if (storedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(storedBuffer, providedBuffer);
}

export type ContractStatusUpdateResult = {
  id: number;
  status: string;
  updatedAt: string;
};

export async function updateContractStatus(
  id: number,
  status: string,
): Promise<ContractStatusUpdateResult | null> {
  const result = await pool.query<{
    id: number;
    status: string;
    updated_at: Date;
  }>(
    `UPDATE contracts
     SET status = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, status, updated_at`,
    [id, status],
  );

  if (!result.rowCount) {
    return null;
  }

  const row = result.rows[0];

  return {
    id: row.id,
    status: row.status,
    updatedAt: row.updated_at.toISOString(),
  };
}
