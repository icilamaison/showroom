import { describe, expect, it } from "vitest";
import { getGiftColorOptions, syncGiftRows } from "./contract-gift";
import { createEmptyProductRow } from "./validation/contract";

function row(name: string, unitPrice: string, quantity = "1") {
  return { ...createEmptyProductRow(), name, unitPrice, quantity };
}

function giftNames(products: ReturnType<typeof syncGiftRows>) {
  return products.filter((product) => product.name.startsWith("(사은품) ")).map((product) => product.name);
}

describe("contract-gift", () => {
  it("할인 후 최종 금액 구간별로 사은품을 넣는다", () => {
    const empty = [createEmptyProductRow(), createEmptyProductRow()];
    expect(giftNames(syncGiftRows([row("러그", "499999"), ...empty], "", true))).toEqual([]);
    expect(giftNames(syncGiftRows([row("러그", "500000"), ...empty], "", true))).toEqual([
      "(사은품) 브릭 쿠션커버 블루 30X50",
      "(사은품) 쿠션솜 30X50",
    ]);
    expect(giftNames(syncGiftRows([row("러그", "1500000")], "", true))).toHaveLength(5);
    // 52만원 10% 할인 → 468,000원이라 사은품 없음
    expect(giftNames(syncGiftRows([row("러그", "520000")], "10", true))).toEqual([]);
  });

  it("금액이 내려가거나 미증정이면 사은품 행을 비우고, 바뀐 게 없으면 같은 배열을 돌려준다", () => {
    const withGifts = syncGiftRows([row("러그", "1000000"), createEmptyProductRow()], "", true);
    expect(giftNames(withGifts)).toHaveLength(4);
    expect(syncGiftRows(withGifts, "", true)).toBe(withGifts);

    const lowered = syncGiftRows([row("러그", "100000"), ...withGifts.slice(1)], "", true);
    expect(giftNames(lowered)).toEqual([]);
    expect(giftNames(syncGiftRows(withGifts, "", false))).toEqual([]);
  });

  it("구스 이불솜 사이즈별로 카페24 사은품 이불커버를 수량만큼 넣는다", () => {
    const goose = (size: string, quantity: string) => ({ ...row("폴란드 마더구스 이불솜", "300000", quantity), size });
    const products = syncGiftRows([goose("SS 160X210", "2"), goose("Q 200X230", "1"), goose("K 230X240", "1"), goose("Q 200X230", "1")], "", false, true);
    // 상품명은 사이즈와 상관없이 같고, 사이즈 칸으로 구분한다
    const quantityOf = (size: string) =>
      products.find((product) => product.name === "본느윗 이불커버 6colors (사은품)" && product.size === size)?.quantity;
    expect(quantityOf("SS 160X210")).toBe("2");
    expect(quantityOf("Q 200X230")).toBe("2");
    expect(quantityOf("K 230X240")).toBe("1");
  });

  it("이불커버는 금액별 사은품과 따로 증정을 골라야 들어간다", () => {
    const goose = { ...row("폴란드 마더구스 이불솜", "600000"), size: "Q 200X230" };
    const tierOnly = syncGiftRows([goose, createEmptyProductRow(), createEmptyProductRow()], "", true, false);
    expect(tierOnly.map((product) => product.name)).toEqual([
      "폴란드 마더구스 이불솜",
      "(사은품) 브릭 쿠션커버 블루 30X50",
      "(사은품) 쿠션솜 30X50",
    ]);
    const gooseOnly = syncGiftRows([goose, createEmptyProductRow()], "", false, true);
    expect(gooseOnly.map((product) => `${product.name} ${product.size}`.trim())).toEqual([
      "폴란드 마더구스 이불솜 Q 200X230",
      "본느윗 이불커버 6colors (사은품) Q 200X230",
    ]);
  });

  it("고른 사은품 컬러는 다시 맞춰도 유지하고, 컬러 옵션에 사이즈가 붙는다", () => {
    expect(getGiftColorOptions("본느윗 이불커버 6colors (사은품)", "Q 200X230")).toEqual(["누디베이지 Q 200X230"]);
    expect(getGiftColorOptions("본느윗 이불커버 6colors (사은품)", "K 230X240")).toEqual([
      "크림화이트 K 230X240",
      "누디베이지 K 230X240",
      "소프트블랙 K 230X240",
    ]);
    expect(getGiftColorOptions("(사은품) 쿠션솜 30X50", "")).toEqual([]);

    const goose = { ...row("폴란드 마더구스 이불솜", "300000"), size: "Q 200X230" };
    const products = syncGiftRows([goose, createEmptyProductRow()], "", false, true).map((product) =>
      product.name.endsWith("(사은품)") ? { ...product, color: "누디베이지 Q 200X230" } : product,
    );
    expect(syncGiftRows(products, "", false, true)).toBe(products);
  });
});
