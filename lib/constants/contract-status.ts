export const CONTRACT_STATUSES = [
  "DRAFTING",
  "SUBMITTED",
  "REVIEWING",
  "ON_HOLD",
  "CONFIRMED",
  "CANCEL_PENDING",
  "CANCELED",
] as const;

export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFTING: "작성중",
  SUBMITTED: "작성완료",
  REVIEWING: "검토중",
  ON_HOLD: "보류",
  CONFIRMED: "계약확정",
  CANCEL_PENDING: "취소예정",
  CANCELED: "취소",
};

export const CONTRACT_STATUS_OPTIONS = [
  { value: "", label: "전체" },
  ...CONTRACT_STATUSES.map((status) => ({
    value: status,
    label: CONTRACT_STATUS_LABELS[status],
  })),
];

export function getContractStatusLabel(status: string): string {
  if (status in CONTRACT_STATUS_LABELS) {
    return CONTRACT_STATUS_LABELS[status as ContractStatus];
  }

  return status;
}
