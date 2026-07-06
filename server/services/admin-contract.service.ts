import { pool } from "../db/pool";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export type ContractListFilters = {
  customerName?: string;
  customerPhone?: string;
  status?: string;
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
  };
}

export async function getContractById(
  id: number,
): Promise<ContractDetail | null> {
  const result = await pool.query<ContractDetailRow>(
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
       updated_at
     FROM contracts
     WHERE id = $1`,
    [id],
  );

  if (!result.rowCount) {
    return null;
  }

  return mapContractDetail(result.rows[0]);
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
