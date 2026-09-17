import catalogData from "../product.json";

export type CatalogSizeOption =
  | string
  | {
      name: string;
      consumerPrice?: number;
      salePrice?: number;
      components?: SetComponent[];
    };

export type ProductSelectOption = {
  value: string;
  label: string;
};

export type SetComponent = {
  productCode?: string;
  name: string;
  quantity?: number;
  consumerPrice?: number;
  colors?: string[];
  sizes?: string[];
  soldOutColors?: string[];
  soldOutSizes?: string[];
};

export type CatalogProduct = {
  productCode: string;
  internalCode: string;
  category: string;
  productNo: number;
  productName: string;
  consumerPrice: number;
  supplyPrice: number;
  productPrice: number;
  salePrice: number;
  colors?: Record<string, string>;
  // 사이즈 옵션 없이 색상만으로 갈리는 상품 중 일부는 색상별로 실제 판매가가 다름(예: 겨울용/봄가을용)
  colorPrices?: Record<string, number>;
  sizes?: CatalogSizeOption[];
  components?: SetComponent[];
  soldOutColors?: string[];
  soldOutSizes?: string[];
};

export function getSizeOptionName(option: CatalogSizeOption): string {
  return typeof option === "string" ? option : option.name;
}

export function normalizeProductOptions(
  options: CatalogSizeOption[] | string[] | undefined,
  baseSalePrice?: number,
): ProductSelectOption[] {
  if (!options?.length) {
    return [];
  }

  return options.map((option) => {
    const value = getSizeOptionName(option);
    const salePrice = typeof option === "object" ? option.salePrice : undefined;

    if (
      baseSalePrice != null &&
      salePrice != null &&
      salePrice > baseSalePrice
    ) {
      const addPrice = salePrice - baseSalePrice;
      return {
        value,
        label: `${value} (+${addPrice.toLocaleString("ko-KR")}원)`,
      };
    }

    return { value, label: value };
  });
}

// 품절 옵션을 목록에서 빼면 카페24에서 재고를 다시 채워도 이 화면에서는 고를 수 없다.
// product.json은 동기화 시점의 스냅샷이라 항상 늦다. 지우지 말고 표시만 해서 담당자가 판단하게 한다.
export function withSoldOutLabels(
  options: CatalogSizeOption[] | string[] | undefined,
  soldOutNames: string[] | undefined,
  baseSalePrice?: number,
): ProductSelectOption[] {
  const soldOut = new Set(soldOutNames ?? []);

  return normalizeProductOptions(options, baseSalePrice).map((option) =>
    soldOut.has(option.value)
      ? { ...option, label: `${option.label} (품절)` }
      : option,
  );
}

export function getSizeSalePrice(
  product: CatalogProduct,
  sizeName: string,
): number | null {
  for (const option of product.sizes ?? []) {
    if (typeof option === "string" || option.name !== sizeName) {
      continue;
    }

    if (option.salePrice != null) {
      return option.salePrice;
    }
  }

  // 컬러 선택 시에도 이 함수로 가격을 조회하므로(ContractForm) colorPrices도 확인
  return product.colorPrices?.[sizeName] ?? null;
}

export function getVariantComponents(
  product: CatalogProduct,
  variantName: string,
): SetComponent[] {
  const normalized = variantName.trim();

  if (!normalized) {
    return product.components ?? [];
  }

  for (const option of product.sizes ?? []) {
    if (
      typeof option === "object" &&
      option.name === normalized &&
      option.components?.length
    ) {
      return option.components;
    }
  }

  return product.components ?? [];
}

const catalog = catalogData as CatalogProduct[];

export function searchProducts(query: string, limit = 8): CatalogProduct[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return [];
  }

  return catalog
    .filter((product) => {
      const name = product.productName.toLowerCase();
      const code = product.productCode.toLowerCase();
      const internal = product.internalCode.toLowerCase();

      return (
        name.includes(normalized) ||
        code.includes(normalized) ||
        internal.includes(normalized)
      );
    })
    .slice(0, limit);
}

export function getDefaultColor(product: CatalogProduct): string {
  const colors = product.colors ? Object.keys(product.colors) : [];
  return colors[0] ?? "";
}

export function isSetProduct(product: CatalogProduct): boolean {
  return Boolean(product.components?.length);
}

export function findCatalogProductByName(name: string): CatalogProduct | null {
  const normalized = name.trim();

  if (!normalized) {
    return null;
  }

  return (
    catalog.find((product) => product.productName.trim() === normalized) ?? null
  );
}

export function findCatalogProductByCode(code: string): CatalogProduct | null {
  const normalized = code.trim();

  if (!normalized) {
    return null;
  }

  return (
    catalog.find((product) => product.productCode === normalized) ?? null
  );
}

export function formatCatalogPrice(price: number): string {
  return `${price.toLocaleString("ko-KR")}원`;
}
