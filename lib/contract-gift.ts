import { contractTotal, totalDiscountAmount } from "./contract-amount";
import {
  createEmptyProductRow,
  GIFT_PREFIX,
  isGiftRow,
  type ProductRow,
} from "./validation/contract";

// 월별 프로모션 사은품. "증정"을 고르면 상품 표에 0원 행으로 넣고, 미증정·조건 미달이면 지운다.
// 달이 바뀌면 GIFT_TIERS·GOOSE_GIFT_NAME만 고친다

// 할인 후 최종 금액 기준. 위 구간은 아래 구간 사은품을 모두 포함한다
const GIFT_TIERS = [
  { minAmount: 500000, names: ["브릭 쿠션커버 블루 30X50", "쿠션솜 30X50"] },
  { minAmount: 1000000, names: ["브릭 쿠션커버 블루 50X50", "쿠션솜 50X50"] },
  { minAmount: 1500000, names: ["컨페티 블랭킷 M"] },
];

// 구스 이불솜 구매 시 이불커버 증정. 플레이오토 주문이 매칭되도록 카페24 사은품 전용 상품(1399~1401)명으로 넣는다.
// 사이즈는 구매한 이불솜을 따르고, 컬러는 사은품 행에서 고른다(카페24 옵션처럼 컬러 뒤에 사이즈가 붙는다)
const GOOSE_PATTERN = /구스 이불솜/;
// 컬러는 카페24 사은품 선택 화면에 노출되는 것만. 상품 옵션에는 6색이 다 있지만 품목 단위로 숨겨져 있다
const GOOSE_GIFTS = [
  { size: /\bK\b/, name: "본느윗 이불커버 K (사은품)", sizeLabel: "K 230X240", colors: ["크림화이트", "누디베이지", "소프트블랙"] },
  { size: /\bQ\b/, name: "본느윗 이불커버 Q (사은품)", sizeLabel: "Q 200X230", colors: ["누디베이지"] },
  // 그 외(SS·사이즈 미선택)는 SS. 카페24 상품명이 "6colors"다
  { size: /^/, name: "본느윗 이불커버 6colors (사은품)", sizeLabel: "SS 160X210", colors: ["크림화이트", "누디베이지", "소프트블랙"] },
];

// 사은품 행에서 고를 컬러 옵션. 컬러를 고르는 사은품이 아니면 빈 배열
export function getGiftColorOptions(name: string): string[] {
  const gift = GOOSE_GIFTS.find((item) => item.name === name);
  return gift ? gift.colors.map((color) => `${color} ${gift.sizeLabel}`) : [];
}

function isEmptyRow(product: ProductRow): boolean {
  return Object.values(product).every((value) => !String(value ?? "").trim());
}

// 지금 상품·할인율에 맞는 사은품 { 상품명: 수량 }
export function getGiftQuantities(
  products: ProductRow[],
  totalDiscountRate: string,
): Map<string, string> {
  const finalAmount =
    contractTotal(products) - totalDiscountAmount(products, totalDiscountRate);
  const gifts = new Map<string, string>();

  for (const tier of GIFT_TIERS) {
    if (finalAmount >= tier.minAmount) {
      tier.names.forEach((name) => gifts.set(`${GIFT_PREFIX}${name}`, "1"));
    }
  }

  // 이불솜 사이즈별로 이불커버 수량을 합친다
  for (const product of products) {
    const quantity = Number(product.quantity) || 0;
    if (!GOOSE_PATTERN.test(product.name) || quantity <= 0) continue;
    const label = `${product.name} ${product.color} ${product.size}`;
    const gift = GOOSE_GIFTS.find((item) => item.size.test(label))!;
    gifts.set(gift.name, String((Number(gifts.get(gift.name)) || 0) + quantity));
  }

  return gifts;
}

// 사은품 행을 조건에 맞춘다. 남는 사은품 행은 비우고, 새 사은품은 빈 행부터 채운다.
// 바뀐 게 없으면 같은 배열을 돌려줘 상태 갱신이 반복되지 않게 한다
export function syncGiftRows(
  products: ProductRow[],
  totalDiscountRate: string,
  provided: boolean,
): ProductRow[] {
  const pending = provided ? getGiftQuantities(products, totalDiscountRate) : new Map<string, string>();
  let changed = false;

  const next = products.map((product) => {
    if (!isGiftRow(product)) {
      return product;
    }

    const quantity = pending.get(product.name);
    pending.delete(product.name); // 같은 사은품 행이 두 번 있으면 뒤의 행은 지운다
    if (quantity === undefined) {
      changed = true;
      return createEmptyProductRow();
    }
    if (product.quantity === quantity && product.unitPrice === "0") {
      return product;
    }
    changed = true;
    return { ...product, quantity, unitPrice: "0" };
  });

  for (const [name, quantity] of pending) {
    changed = true;
    const row = { ...createEmptyProductRow(), name, quantity, unitPrice: "0" };
    const emptyIndex = next.findIndex(isEmptyRow);
    if (emptyIndex >= 0) {
      next[emptyIndex] = row;
    } else {
      next.push(row);
    }
  }

  return changed ? next : products;
}
