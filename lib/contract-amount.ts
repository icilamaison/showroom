import type { ProductRow } from "./validation/contract";

type AmountInput = Pick<ProductRow, "quantity" | "unitPrice">;

// 한 줄 금액 = 수량 × 단가. 빈칸/숫자 아님은 0으로 처리.
export function lineAmount({ quantity, unitPrice }: AmountInput): number {
  const qty = Number(quantity);
  const price = Number(unitPrice);
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0;
  return qty * price;
}

// 전체 합계 = 모든 줄 금액의 합.
export function contractTotal(products: AmountInput[]): number {
  return products.reduce((sum, product) => sum + lineAmount(product), 0);
}

export function formatAmount(value: number): string {
  return value.toLocaleString("ko-KR");
}

// 저장은 숫자만, 화면 입력칸은 천단위 콤마로 표시할 때 사용.
export function toDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatDigits(value: string): string {
  const digits = toDigits(value);
  return digits ? Number(digits).toLocaleString("ko-KR") : "";
}
