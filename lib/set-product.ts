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

// 색상도 사이즈와 같이 단독 상품 colors를 우선 사용한다.
// 세트 components에 colors가 비어 있어도(덤프 options 누락) 하위 메뉴가 나오게 한다.
export function resolveComponentColorOptions(
  component: SetComponent,
): string[] {
  if (component.colors?.length) {
    return component.colors;
  }

  const catalogProduct = resolveComponentCatalogProduct(component);
  if (catalogProduct?.colors) {
    return Object.keys(catalogProduct.colors);
  }

  return [];
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
    const colors = resolveComponentColorOptions(component);
    const sizes = resolveComponentSizeOptions(component);
    const size =
      sizes.length === 1
        ? typeof sizes[0] === "string"
          ? sizes[0]
          : sizes[0].name
        : "";

    return {
      color: colors.length === 1 ? colors[0] : "",
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
      // 컬러·사이즈를 둘 다 고르는 구성품(본느윗 베개커버)은 사이즈가 빠지지 않게 " / "로 함께 저장한다
      if (selection?.color && selection.size) {
        return `${selection.color} / ${selection.size}`;
      }
      return selection?.color || selection?.size || "";
    })
    .filter(Boolean);

  if (options.length === 0) {
    return "";
  }

  return `COLOR=${options.join(", ")}`;
}

// 저장 값의 "COLOR=" 접두어는 세트 옵션을 알아보고 복원하는 표식이라 남겨 두고, 화면에서만 뗀다.
// 예전 " + " 형식으로 저장된 계약서도 ", "로 맞춰 보여준다.
export function formatSetOptionLabel(color: string): string {
  return color.trim().startsWith("COLOR=")
    ? parseSetColorOptions(color).join(", ")
    : color;
}

export function parseSetColorOptions(color: string): string[] {
  if (!color.trim().startsWith("COLOR=")) {
    return [];
  }

  // 구분자는 ", "(카페24 주문 옵션 형식). 이전에 저장된 계약서는 " + "로 묶여 있어 둘 다 읽는다.
  const options = color.trim().slice(6);
  return options
    .split(options.includes(", ") ? ", " : " + ")
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
    // "세레니티 / 50X70" = 컬러 / 사이즈. "Q/K 200X220"처럼 공백 없는 "/"는 컬러 값의 일부라 나누지 않는다
    const [colorOption, sizeOption = ""] = option.split(" / ");
    const size = component.colors?.length ? sizeOption : option;
    const defaults = {
      quantity: String(component.quantity ?? 1),
      unitPrice: resolveComponentUnitPrice(component, catalogProduct, size),
    };

    if (component.colors?.length) {
      return { color: colorOption, size, ...defaults };
    }

    if (component.sizes?.length) {
      return { color: "", size: option, ...defaults };
    }

    return { color: option, size: "", ...defaults };
  });
}

// 엑셀(플레이오토)용: 카페24 주문 목록의 세트 옵션명과 같은 형식으로 만든다.
// 예: [세트][SET] 아카네 차렵 3colors아카네 차렵이불 3colors(1개) - COLOR=브릭 SS 160X210아카네 베개커버 3colors(1개) - COLOR=브릭 50X70
// 카페24도 구성품 사이에 구분자 없이 이어 붙인다.
export function formatCafe24SetOptionName(
  setName: string,
  components: SetComponent[],
  color: string,
): string {
  const options = buildSetSelectionsFromColor(components, color)
    .map((selection, index) => {
      const component = components[index];
      return [
        `${component.name}(${component.quantity ?? 1}개)`,
        selection.color ? `COLOR=${selection.color}` : "",
        selection.size ? `SIZE=${selection.size}` : "",
      ]
        .filter(Boolean)
        .join(" - ");
    })
    .join("");

  return `[세트]${setName}${options}`;
}
