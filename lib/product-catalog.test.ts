import { describe, expect, it } from "vitest";
import {
  findCatalogProductByName,
  formatCatalogProductNo,
  isShowroomOnlyProduct,
  getDefaultColor,
  normalizeProductOptions,
  resolveCafe24Variant,
  searchProducts,
  withSizeSiblings,
  type CatalogProduct,
} from "./product-catalog";

describe("searchProducts", () => {
  it("finds products by name", () => {
    const results = searchProducts("오슬로");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.productName).toContain("오슬로");
  });

  it("finds products by product code", () => {
    const results = searchProducts("P0000BVU");

    expect(results).toHaveLength(1);
    expect(results[0]?.productCode).toBe("P0000BVU");
  });

  it("excludes hidden (미진열·판매 안 함) products", () => {
    // [SET] 쿨포터 냉감 베딩: 카페24 미진열
    expect(searchProducts("P0000BVP")).toEqual([]);
  });

  it("returns empty list for blank query", () => {
    expect(searchProducts("")).toEqual([]);
    expect(searchProducts("   ")).toEqual([]);
  });
});

describe("getDefaultColor", () => {
  it("returns first color when available", () => {
    const product = {
      colors: { 화이트: "#ffffff", 블랙: "#000000" },
    } as CatalogProduct;

    expect(getDefaultColor(product)).toBe("화이트");
  });
});

describe("normalizeProductOptions", () => {
  it("appends add-on price to label when size costs more than base", () => {
    const options = normalizeProductOptions(
      [
        { name: "SS 차렵이불+베개커버1P", salePrice: 112700 },
        { name: "QK겸용 차렵이불+베개커버2P", salePrice: 163100 },
      ],
      112700,
    );

    expect(options[0]?.label).toBe("SS 차렵이불+베개커버1P");
    expect(options[1]?.label).toBe("QK겸용 차렵이불+베개커버2P (+50,400원)");
  });
});

describe("모노 비벤디 size siblings", () => {
  it("adds ORDER-MADE 300X400 as 4호 on 모노 비벤디 10colors", () => {
    const product = findCatalogProductByName("모노 비벤디 10colors");
    expect(product).not.toBeNull();

    const sizes = withSizeSiblings(product!).sizes?.map((option) =>
      typeof option === "string" ? option : option.name,
    );

    expect(sizes).toEqual([
      "반호 150X200",
      "1호 160X240",
      "2호 200X300",
      "3호 240X350",
      "4호 300X400",
    ]);
  });

  it("maps 4호 back to 모노 비벤디 ORDER-MADE for PlayAuto", () => {
    expect(
      resolveCafe24Variant("모노 비벤디 10colors", "아이보리", "4호 300X400"),
    ).toEqual({
      productName: "모노 비벤디 ORDER-MADE",
      color: "아이보리",
      size: "300X400 이하",
    });
  });
});

describe("쇼룸 단독 상품번호 표시", () => {
  it("쇼룸 단독은 번호 대신 문구로 보여준다", () => {
    const product = findCatalogProductByName("브리티쉬");
    expect(product).not.toBeNull();
    expect(isShowroomOnlyProduct(product!)).toBe(true);
    expect(formatCatalogProductNo(product)).toBe("쇼룸 단독");
    expect(formatCatalogProductNo(null)).toBe("-");
  });
});
