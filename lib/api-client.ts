import type { ValidatedContractFormValues } from "./validation/contract";

export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
};

export type ApiErrorResponse = {
  success: false;
  message: string;
  errors?: Record<string, string>;
};

export type SubmitContractResult = {
  contractNumber: string;
  viewToken: string;
  status: string;
};

export class ApiClientError extends Error {
  status: number;
  errors?: Record<string, string>;

  constructor(
    message: string,
    status: number,
    errors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.errors = errors;
  }
}

type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

async function parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
  return response.json() as Promise<ApiResponse<T>>;
}

export async function submitContract(
  payload: ValidatedContractFormValues,
): Promise<SubmitContractResult> {
  const response = await fetch("/api/contracts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const body = await parseResponse<SubmitContractResult>(response);

  if (!response.ok || !body.success) {
    const errorBody = body as ApiErrorResponse;

    throw new ApiClientError(
      errorBody.message || "요청에 실패했습니다.",
      response.status,
      errorBody.errors,
    );
  }

  return body.data;
}

export type AdminLoginResult = {
  username: string;
};

export async function loginAdmin(
  username: string,
  password: string,
): Promise<AdminLoginResult> {
  const response = await fetch("/api/admin/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });

  const body = await parseResponse<AdminLoginResult>(response);

  if (!response.ok || !body.success) {
    const errorBody = body as ApiErrorResponse;

    throw new ApiClientError(
      errorBody.message || "로그인에 실패했습니다.",
      response.status,
      errorBody.errors,
    );
  }

  return body.data;
}

export async function logoutAdmin(): Promise<void> {
  await fetch("/api/admin/logout", {
    method: "POST",
    credentials: "include",
  });
}

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

export type AdminContractListFilters = {
  customerName?: string;
  customerPhone?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
};

async function adminFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const body = await parseResponse<T>(response);

  if (!response.ok || !body.success) {
    const errorBody = body as ApiErrorResponse;

    throw new ApiClientError(
      errorBody.message || "요청에 실패했습니다.",
      response.status,
      errorBody.errors,
    );
  }

  return body.data;
}

export async function fetchAdminContracts(
  filters: AdminContractListFilters = {},
): Promise<ContractListResult> {
  const params = new URLSearchParams();

  if (filters.customerName?.trim()) {
    params.set("customerName", filters.customerName.trim());
  }

  if (filters.customerPhone?.trim()) {
    params.set("customerPhone", filters.customerPhone.trim());
  }

  if (filters.status?.trim()) {
    params.set("status", filters.status.trim());
  }

  if (filters.dateFrom?.trim()) {
    params.set("dateFrom", filters.dateFrom.trim());
  }

  if (filters.dateTo?.trim()) {
    params.set("dateTo", filters.dateTo.trim());
  }

  if (filters.page) {
    params.set("page", String(filters.page));
  }

  if (filters.limit) {
    params.set("limit", String(filters.limit));
  }

  const query = params.toString();
  const url = query ? `/api/admin/contracts?${query}` : "/api/admin/contracts";

  return adminFetch<ContractListResult>(url);
}

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

export type ContractStatusUpdateResult = {
  id: number;
  status: string;
  updatedAt: string;
};

export async function fetchAdminContractById(
  id: number,
): Promise<ContractDetail> {
  return adminFetch<ContractDetail>(`/api/admin/contracts/${id}`);
}

export async function fetchPublicContract(
  contractNumber: string,
  token: string,
): Promise<ContractDetail> {
  const response = await fetch(
    `/api/contracts/public/${encodeURIComponent(contractNumber)}?token=${encodeURIComponent(token)}`,
  );

  const body = await parseResponse<ContractDetail>(response);

  if (!response.ok || !body.success) {
    const errorBody = body as ApiErrorResponse;

    throw new ApiClientError(
      errorBody.message || "계약서를 찾을 수 없습니다.",
      response.status,
      errorBody.errors,
    );
  }

  return body.data;
}

export async function updateAdminContractStatus(
  id: number,
  status: string,
): Promise<ContractStatusUpdateResult> {
  return adminFetch<ContractStatusUpdateResult>(
    `/api/admin/contracts/${id}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
}

export function getAdminOrderExcelDownloadUrl(id: number): string {
  return `/api/admin/contracts/${id}/order-excel`;
}

export function getAdminBulkOrderExcelDownloadUrl(
  filters: AdminContractListFilters = {},
): string {
  const params = new URLSearchParams();

  if (filters.customerName?.trim()) {
    params.set("customerName", filters.customerName.trim());
  }

  if (filters.customerPhone?.trim()) {
    params.set("customerPhone", filters.customerPhone.trim());
  }

  if (filters.status?.trim()) {
    params.set("status", filters.status.trim());
  }

  if (filters.dateFrom?.trim()) {
    params.set("dateFrom", filters.dateFrom.trim());
  }

  if (filters.dateTo?.trim()) {
    params.set("dateTo", filters.dateTo.trim());
  }

  const query = params.toString();
  return query
    ? `/api/admin/contracts/order-excel?${query}`
    : "/api/admin/contracts/order-excel";
}

function parseDownloadFilename(
  disposition: string | null,
  fallback: string,
): string {
  if (!disposition) {
    return fallback;
  }

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const asciiMatch = disposition.match(/filename="([^"]+)"/i);
  if (asciiMatch?.[1]) {
    return asciiMatch[1];
  }

  return fallback;
}

function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function downloadAdminFile(
  url: string,
  fallbackFilename: string,
): Promise<void> {
  const response = await fetch(url, {
    credentials: "include",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | ApiErrorResponse
      | null;

    throw new ApiClientError(
      body?.message || "파일 다운로드에 실패했습니다.",
      response.status,
      body?.errors,
    );
  }

  const blob = await response.blob();
  const filename = parseDownloadFilename(
    response.headers.get("Content-Disposition"),
    fallbackFilename,
  );

  triggerFileDownload(blob, filename);
}

async function downloadAdminExcelFile(
  url: string,
  fallbackFilename: string,
): Promise<void> {
  return downloadAdminFile(url, fallbackFilename);
}

export async function downloadAdminOrderExcel(id: number): Promise<void> {
  return downloadAdminExcelFile(
    getAdminOrderExcelDownloadUrl(id),
    `playauto_order_${id}.xlsx`,
  );
}

export async function downloadAdminBulkOrderExcel(
  filters: AdminContractListFilters = {},
): Promise<void> {
  const from = filters.dateFrom?.trim() || "all";
  const to = filters.dateTo?.trim() || "all";

  return downloadAdminExcelFile(
    getAdminBulkOrderExcelDownloadUrl(filters),
    `playauto_orders_${from}_${to}.xlsx`,
  );
}
