import type { ProductRow, PurchaseContractPayload } from "./validation/contract";
import { formatFullAddress } from "./address";
import { findCatalogProductByName, resolveCafe24Variant } from "./product-catalog";
import { formatCafe24SetOptionName, formatSetOptionLabel } from "./set-product";

export const ORDER_EXCEL_HEADERS = [
  "쇼핑몰주문번호",
  "주문자명",
  "주문자ID",
  "주문자휴대폰번호",
  "주문자전화번호",
  "수령자명",
  "수령자영문명",
  "수령자휴대폰번호",
  "수령자전화번호",
  "우편번호",
  "주소",
  "배송메세지",
  "쇼핑몰 상품코드",
  "판매자 관리코드",
  "온라인 상품명",
  "옵션명",
  "주문수량",
  "SKU코드(세트코드)",
  "건별출고수량",
  "배송처 코드",
  "금액",
  "공급가",
  "원가",
  "실결제금액",
  "할인금액",
  "추가구매 옵션명",
  "추가구매 SKU코드(세트코드)",
  "추가구매 건별출고수량",
  "추가구매 주문수량",
  "배송방법",
  "배송비",
  "사은품",
  "개인통관번호",
  "주문일",
  "결제완료일",
  "국가코드",
  "결제통화",
] as const;

export const ORDER_EXCEL_REQUIRED_FIELDS = [
  "주문자명",
  "주문자휴대폰번호",
  "수령자명",
  "수령자휴대폰번호",
  "우편번호",
  "주소",
  "온라인 상품명",
  "주문수량",
  "금액",
] as const satisfies ReadonlyArray<(typeof ORDER_EXCEL_HEADERS)[number]>;

export type OrderExcelRow = Record<(typeof ORDER_EXCEL_HEADERS)[number], string>;

export function formatShoppingMallOrderNumber(
  approvalNumber: string | undefined | null,
): string {
  const normalized = approvalNumber?.trim().replace(/^SR/i, "") ?? "";

  if (!normalized || !/^\d+$/.test(normalized)) {
    return "";
  }

  return `SR${normalized}`;
}

export function isPurchaseContractPayload(
  payload: unknown,
): payload is PurchaseContractPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "buyerName" in payload &&
    "products" in payload
  );
}

// 플레이오토 업로드용: 카페24 주문 목록과 같은 상품명·옵션명으로 내보낸다.
// 예: "슬록 1호 160X240" / "TYPE=모노타입, COLOR=아이보리 1호 160X240"
function buildCafe24ProductAndOption(product: ProductRow): {
  productName: string;
  optionName: string;
} {
  const color = product.color.trim();

  // 세트는 구성품 옵션을 이어 붙인 값. 카탈로그에서 구성품을 못 찾으면 저장 값 그대로(예전 " + " 형식도 ", "로 맞춘다)
  if (color.startsWith("COLOR=")) {
    const components = findCatalogProductByName(product.name)?.components;
    return {
      productName: product.name.trim(),
      optionName: components?.length
        ? formatCafe24SetOptionName(product.name.trim(), components, color)
        : `COLOR=${formatSetOptionLabel(color)}`,
    };
  }

  const variant = resolveCafe24Variant(product.name, color, product.size.trim());
  const type = (product.type ?? "").trim();

  return {
    productName: variant.productName,
    optionName: [
      type ? `TYPE=${type}` : "",
      variant.color ? `COLOR=${variant.color}` : "",
      variant.size ? `SIZE=${variant.size}` : "",
    ]
      .filter(Boolean)
      .join(", "),
  };
}

function resolveRecipientName(payload: PurchaseContractPayload): string {
  if (payload.recipientSameAsBuyer) {
    return payload.buyerName;
  }

  return payload.recipientName.trim();
}

function resolveRecipientPhone(payload: PurchaseContractPayload): string {
  if (payload.recipientSameAsBuyer) {
    return payload.buyerPhone;
  }

  return payload.recipientPhone.trim();
}

function createEmptyOrderExcelRow(): OrderExcelRow {
  return Object.fromEntries(
    ORDER_EXCEL_HEADERS.map((header) => [header, ""]),
  ) as OrderExcelRow;
}

function safeTrim(value: string | undefined): string {
  return value?.trim() ?? "";
}

function buildLineAmount(product: ProductRow): string {
  return safeTrim(product.unitPrice);
}

function buildSharedOrderFields(
  payload: PurchaseContractPayload,
  shoppingMallOrderNumber: string,
): Omit<
  OrderExcelRow,
  "온라인 상품명" | "옵션명" | "주문수량" | "금액" | "배송메세지"
> {
  const row = createEmptyOrderExcelRow();

  row["쇼핑몰주문번호"] = shoppingMallOrderNumber;
  row["주문자명"] = payload.buyerName;
  row["주문자휴대폰번호"] = payload.buyerPhone;
  row["수령자명"] = resolveRecipientName(payload);
  row["수령자휴대폰번호"] = resolveRecipientPhone(payload);
  row["우편번호"] = safeTrim(payload.recipientPostalCode);
  row["주소"] = formatFullAddress(
    payload.recipientAddress,
    payload.recipientAddressDetail,
  );
  row["주문일"] = payload.writtenDate;
  row["결제완료일"] = payload.agreementDate;
  row["국가코드"] = "KR";

  return row;
}

export function buildOrderExcelRows(
  payload: PurchaseContractPayload,
  shoppingMallOrderNumber = "",
): OrderExcelRow[] {
  const sharedFields = buildSharedOrderFields(payload, shoppingMallOrderNumber);

  return payload.products
    .filter((product) => product.name.trim())
    .map((product) => {
      const { productName, optionName } = buildCafe24ProductAndOption(product);
      return {
        ...sharedFields,
        "온라인 상품명": productName,
        "옵션명": optionName,
        "주문수량": safeTrim(product.quantity),
        "금액": buildLineAmount(product),
        "배송메세지": safeTrim(product.remarks ?? ""),
      };
    });
}

export function findMissingOrderExcelRequiredFields(
  rows: OrderExcelRow[],
): string[] {
  const missing = new Set<string>();

  for (const row of rows) {
    for (const field of ORDER_EXCEL_REQUIRED_FIELDS) {
      if (!row[field]?.trim()) {
        missing.add(field);
      }
    }
  }

  return [...missing];
}
