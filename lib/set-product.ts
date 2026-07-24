import type { CatalogProduct, CatalogSizeOption, SetComponent } from "./product-catalog";
import {
  findCatalogProductByCode,
  findCatalogProductByName,
  getSizeSalePrice,
} from "./product-catalog";

export type SetComponentSelection = {
  color: string;
  size: string;
  quantity: string;
  unitPrice: string;
};

function resolveComponentCatalogProduct(
  component: SetComponent,
): CatalogProduct | null {
  if (component.productCode) {
    return findCatalogProductByCode(component.productCode);
  }

  return findCatalogProductByName(component.name);
}

function resolveComponentUnitPrice(
  component: SetComponent,
  catalogProduct: CatalogProduct | null,
  size: string,
): string {
  if (component.consumerPrice != null && component.consumerPrice > 0) {
    return String(component.consumerPrice);
  }

  const sizeSalePrice = catalogProduct && size ? getSizeSalePrice(catalogProduct, size) : null;
  if (sizeSalePrice != null) {
    return String(sizeSalePrice);
  }

  if (catalogProduct?.salePrice != null && catalogProduct.salePrice > 0) {
    return String(catalogProduct.salePrice);
  }

  return "";
}

// 컴포넌트의 사이즈 선택이 바뀔 때(예: 본느윗 베개커버 50X70 선택 시 +3,900원) 가격을 다시 계산하기 위해 외부(page.tsx)에 노출
export function resolveComponentPriceForSize(
  component: SetComponent,
  size: string,
): string {
  return resolveComponentUnitPrice(component, resolveComponentCatalogProduct(component), size);
}

// 사이즈 드롭다운에 "(+3,900원)" 같은 추가금 힌트를 보여주기 위해, 컴포넌트와 이름이 같은 독립 상품의
// sizes(가격 포함) 데이터를 우선 사용한다. 매칭되는 상품이 없으면 컴포넌트 자체의 sizes(이름만)로 대체.
export function resolveComponentSizeOptions(
  component: SetComponent,
): CatalogSizeOption[] {
  const catalogProduct = resolveComponentCatalogProduct(component);
  if (catalogProduct?.sizes?.length) {
    return catalogProduct.sizes;
  }

  return component.sizes ?? [];
}

export function resolveComponentBaseSalePrice(
  component: SetComponent,
): number | undefined {
  if (component.consumerPrice != null && component.consumerPrice > 0) {
    return component.consumerPrice;
  }

  return resolveComponentCatalogProduct(component)?.salePrice;
}

export function createSetComponentSelections(
  components: SetComponent[],
): SetComponentSelection[] {
  return components.map((component) => {
    const catalogProduct = resolveComponentCatalogProduct(component);
    const size = component.sizes?.length === 1 ? component.sizes[0] : "";

    return {
      color: component.colors?.length === 1 ? component.colors[0] : "",
      size,
      quantity: String(component.quantity ?? 1),
      unitPrice: resolveComponentUnitPrice(component, catalogProduct, size),
    };
  });
}

export function formatSetOptionName(
  components: SetComponent[],
  selections: SetComponentSelection[],
): string {
  const options = components
    .map((_, index) => {
      const selection = selections[index];
      return selection?.color || selection?.size || "";
    })
    .filter(Boolean);

  if (options.length === 0) {
    return "";
  }

  return `COLOR=${options.join(" + ")}`;
}

export function parseSetColorOptions(color: string): string[] {
  if (!color.trim().startsWith("COLOR=")) {
    return [];
  }

  return color
    .trim()
    .slice(6)
    .split(" + ")
    .map((option) => option.trim())
    .filter(Boolean);
}

export function buildSetSelectionsFromColor(
  components: SetComponent[],
  color: string,
): SetComponentSelection[] {
  const options = parseSetColorOptions(color);

  return components.map((component, index) => {
    const option = options[index] ?? "";
    const catalogProduct = resolveComponentCatalogProduct(component);
    const size = component.colors?.length ? "" : option;
    const defaults = {
      quantity: String(component.quantity ?? 1),
      unitPrice: resolveComponentUnitPrice(component, catalogProduct, size),
    };

    if (component.colors?.length) {
      return { color: option, size: "", ...defaults };
    }

    if (component.sizes?.length) {
      return { color: "", size: option, ...defaults };
    }

    return { color: option, size: "", ...defaults };
  });
}
