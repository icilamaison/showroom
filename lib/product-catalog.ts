import catalogData from "../product.json";

export type SetComponent = {
  name: string;
  colors?: string[];
  sizes?: string[];
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
  sizes?: string[];
  components?: SetComponent[];
};

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

export function formatCatalogPrice(price: number): string {
  return `${price.toLocaleString("ko-KR")}원`;
}
