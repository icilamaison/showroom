export function formatFullAddress(base: string, detail: string): string {
  return [base.trim(), detail.trim()].filter(Boolean).join(" ");
}
