import { describe, expect, it } from "vitest";
import {
  getDefaultColor,
  normalizeProductOptions,
  searchProducts,
  type CatalogProduct,
} from "./product-catalog";

describe("searchProducts", () => {
  it("finds products by name", () => {
    const results = searchProducts("쿨포터");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.productName).toContain("쿨포터");
  });

  it("finds products by product code", () => {
    const results = searchProducts("P0000BVP");

    expect(results).toHaveLength(1);
    expect(results[0]?.productCode).toBe("P0000BVP");
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
