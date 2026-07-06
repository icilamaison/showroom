export const CONTRACT_STATUSES = [
  "SUBMITTED",
  "REVIEWING",
  "CONFIRMED",
  "CANCELED",
] as const;

export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  SUBMITTED: "작성완료",
  REVIEWING: "검토중",
  CONFIRMED: "계약확정",
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
