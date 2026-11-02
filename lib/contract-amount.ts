import type { ProductRow } from "./validation/contract";

type AmountInput = Pick<ProductRow, "quantity" | "unitPrice" | "discountRate"> & {
  name?: string;
};

// 카페24 '기타' 카테고리(cate_no=315) 상품은 개별·전체 할인 모두 적용하지 않는다.
// 계약서에 저장되는 상품명 기준이라 카페24 상품명의 "(sy)"는 떼고 비교한다
const NO_DISCOUNT_PRODUCT_NAMES = [
  "미끄럼방지 패드 4P",
  "러그 보관용 버클스트랩",
  "기프트 박스",
  "쇼핑백",
  "리유저블백",
];

export function isNoDiscountProduct(name: string | undefined): boolean {
  return NO_DISCOUNT_PRODUCT_NAMES.includes((name ?? "").replace(/\s*\(sy\)$/, "").trim());
}

function toRate(discountRate: string | undefined): number {
  const rate = Number(discountRate);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

// 할인 적용 금액. 포스와 같게 할인 금액의 원 단위 미만은 버린다
// (예: 597,835원 5% → 할인 29,891.75 → 29,891 → 567,944원)
function applyDiscount(amount: number, discountRate: string | undefined): number {
  return amount - Math.floor((amount * toRate(discountRate)) / 100);
}

// 개별 할인 적용 단가. 숫자 아님은 0으로 처리.
export function discountedUnitPrice({
  name,
  unitPrice,
  discountRate,
}: Omit<AmountInput, "quantity">): number {
  const price = Number(unitPrice);
  if (!Number.isFinite(price)) return 0;
  return applyDiscount(price, isNoDiscountProduct(name) ? "" : discountRate);
}

// 한 줄 금액 = 수량 × 개별 할인 적용 단가. 빈칸/숫자 아님은 0으로 처리.
export function lineAmount(product: AmountInput): number {
  const qty = Number(product.quantity);
  if (!Number.isFinite(qty)) return 0;
  return qty * discountedUnitPrice(product);
}

// 소계 = 모든 줄 금액의 합 (개별 할인 반영, 전체 할인 적용 전).
export function contractTotal(products: AmountInput[]): number {
  return products.reduce((sum, product) => sum + lineAmount(product), 0);
}

// 전체 할인 금액. 할인 제외 상품을 뺀 소계에만 할인율을 적용한다
export function totalDiscountAmount(products: AmountInput[], discountRate: string): number {
  const discountable = contractTotal(
    products.filter((product) => !isNoDiscountProduct(product.name)),
  );
  return discountable - applyDiscount(discountable, discountRate);
}

// 최종 합계 = 소계 - 전체 할인 금액.
export function applyTotalDiscount(
  subtotal: number,
  discountRate: string,
): number {
  return applyDiscount(subtotal, discountRate);
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
