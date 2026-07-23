import type { CatalogProduct, SetComponent } from "./product-catalog";
import {
  findCatalogProductByCode,
  findCatalogProductByName,
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
): string {
  if (component.consumerPrice != null && component.consumerPrice > 0) {
    return String(component.consumerPrice);
  }

  if (catalogProduct?.salePrice != null && catalogProduct.salePrice > 0) {
    return String(catalogProduct.salePrice);
  }

  return "";
}

export function createSetComponentSelections(
  components: SetComponent[],
): SetComponentSelection[] {
  return components.map((component) => {
    const catalogProduct = resolveComponentCatalogProduct(component);

    return {
      color: component.colors?.length === 1 ? component.colors[0] : "",
      size: component.sizes?.length === 1 ? component.sizes[0] : "",
      quantity: String(component.quantity ?? 1),
      unitPrice: resolveComponentUnitPrice(component, catalogProduct),
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
    const defaults = {
      quantity: String(component.quantity ?? 1),
      unitPrice: resolveComponentUnitPrice(component, catalogProduct),
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
