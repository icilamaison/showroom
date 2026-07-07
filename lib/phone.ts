const PHONE_DIGIT_LIMIT = 11;

export function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, PHONE_DIGIT_LIMIT);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export const PHONE_FORM_FIELDS = new Set([
  "buyerPhone",
  "recipientPhone",
  "cashReceiptPhone",
]);
