import type { PurchaseContractPayload } from "./validation/contract";
import type { ContractFormValues } from "./validation/contract";

export function purchasePayloadToFormValues(
  payload: PurchaseContractPayload,
): ContractFormValues {
  return {
    managerName: payload.managerName,
    writtenDateYear: payload.writtenDateYear,
    writtenDateMonth: payload.writtenDateMonth,
    writtenDateDay: payload.writtenDateDay,
    buyerName: payload.buyerName,
    buyerPhone: payload.buyerPhone,
    recipientSameAsBuyer: payload.recipientSameAsBuyer,
    recipientName: payload.recipientName,
    recipientPhone: payload.recipientPhone,
    recipientPostalCode: payload.recipientPostalCode,
    recipientAddress: payload.recipientAddress,
    recipientAddressDetail: payload.recipientAddressDetail,
    products: payload.products,
    totalDiscountRate: payload.totalDiscountRate ?? "",
    paymentMethod: payload.paymentMethod,
    cashReceiptType: payload.cashReceiptType ?? "",
    cashReceiptPhone: payload.cashReceiptPhone,
    cashReceiptBusinessNumber: payload.cashReceiptBusinessNumber,
    taxInvoiceRequested: payload.taxInvoiceRequested,
    taxInvoiceEmail: payload.taxInvoiceEmail,
    agreementDateYear: payload.agreementDateYear,
    agreementDateMonth: payload.agreementDateMonth,
    agreementDateDay: payload.agreementDateDay,
    signatureName: payload.signatureName,
    signatureDataUrl: payload.signatureDataUrl,
    termsAgreed: payload.termsAgreed,
    marketingConsentAgreed: payload.marketingConsentAgreed ?? false,
  };
}

export function buildContractPdfFilename(contractNumber: string): string {
  const safeContractNumber = contractNumber.replace(/[^\w-]+/g, "_");
  return `contract_${safeContractNumber}.pdf`;
}
