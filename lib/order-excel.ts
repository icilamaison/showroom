import type { ProductRow, PurchaseContractPayload } from "./validation/contract";

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

export type OrderExcelRow = Record<(typeof ORDER_EXCEL_HEADERS)[number], string>;

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

function buildOptionName(product: ProductRow): string {
  const parts = [product.color.trim(), product.size.trim()].filter(Boolean);
  return parts.join(",");
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

function resolveRecipientAddress(payload: PurchaseContractPayload): string {
  if (payload.recipientSameAsBuyer) {
    return "";
  }

  return payload.recipientAddress.trim();
}

function createEmptyOrderExcelRow(): OrderExcelRow {
  return Object.fromEntries(
    ORDER_EXCEL_HEADERS.map((header) => [header, ""]),
  ) as OrderExcelRow;
}

function buildSharedOrderFields(
  payload: PurchaseContractPayload,
  contractNumber: string,
): Omit<OrderExcelRow, "온라인 상품명" | "옵션명" | "주문수량" | "배송메세지"> {
  const row = createEmptyOrderExcelRow();

  row["쇼핑몰주문번호"] = "auto";
  row["주문자명"] = payload.buyerName;
  row["주문자ID"] = contractNumber;
  row["주문자휴대폰번호"] = payload.buyerPhone;
  row["수령자명"] = resolveRecipientName(payload);
  row["수령자휴대폰번호"] = resolveRecipientPhone(payload);
  row["주소"] = resolveRecipientAddress(payload);
  row["주문일"] = payload.writtenDate;
  row["결제완료일"] = payload.agreementDate;
  row["국가코드"] = "KR";

  return row;
}

export function buildOrderExcelRows(
  payload: PurchaseContractPayload,
  contractNumber: string,
): OrderExcelRow[] {
  const sharedFields = buildSharedOrderFields(payload, contractNumber);

  return payload.products
    .filter((product) => product.name.trim())
    .map((product) => ({
      ...sharedFields,
      "온라인 상품명": product.name.trim(),
      "옵션명": buildOptionName(product),
      "주문수량": product.quantity.trim(),
      "배송메세지": product.remarks.trim(),
    }));
}
