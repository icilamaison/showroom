import { describe, expect, it } from "vitest";
import {
  createEmptyProductRows,
  type ContractFormValues,
  validateContractForm,
} from "./contract";

const validFormValues: ContractFormValues = {
  managerName: "김담당",
  writtenDateYear: "2026",
  writtenDateMonth: "6",
  writtenDateDay: "24",
  buyerName: "홍길동",
  buyerPhone: "010-1234-5678",
  recipientSameAsBuyer: true,
  recipientName: "",
  recipientPhone: "",
  recipientPostalCode: "06234",
  recipientAddress: "서울시 강남구 테헤란로 1",
  recipientAddressDetail: "101동 1001호",
  products: createEmptyProductRows().map((product, index) =>
    index === 0
      ? {
          ...product,
          name: "프리미엄 침구 세트",
          color: "아이보리",
          size: "Q",
          quantity: "1",
          unitPrice: "150000",
          remarks: "",
        }
      : product,
  ),
  totalDiscountRate: "",
  paymentMethod: "card",
  cashReceiptType: "",
  cashReceiptPhone: "",
  cashReceiptBusinessNumber: "",
  taxInvoiceRequested: false,
  taxInvoiceEmail: "",
  agreementDateYear: "2026",
  agreementDateMonth: "6",
  agreementDateDay: "24",
  signatureName: "홍길동",
  signatureDataUrl: "data:image/png;base64,test",
  termsAgreed: true,
  marketingConsentAgreed: false,
};

describe("validateContractForm", () => {
  it("accepts valid form values", () => {
    const result = validateContractForm(validFormValues);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.buyerName).toBe("홍길동");
      expect(result.data.writtenDate).toBe("2026-06-24");
      expect(result.data.agreementDate).toBe("2026-06-24");
      expect(result.data.signatureDataUrl).toBe("data:image/png;base64,test");
    }
  });

  it("rejects missing required fields", () => {
    const result = validateContractForm({
      ...validFormValues,
      buyerName: "",
      products: createEmptyProductRows(),
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.buyerName).toBeDefined();
      expect(result.errors.products).toBeDefined();
    }
  });

  it("rejects invalid phone format", () => {
    const result = validateContractForm({
      ...validFormValues,
      buyerPhone: "01012345678",
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.buyerPhone).toBe(
        "연락처는 010-0000-0000 형식으로 입력해주세요.",
      );
    }
  });

  it("requires a drawn signature", () => {
    const result = validateContractForm({
      ...validFormValues,
      signatureDataUrl: "",
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.signatureDataUrl).toBe("서명을 입력해주세요.");
    }
  });

  it("requires recipient details when not same as buyer", () => {
    const result = validateContractForm({
      ...validFormValues,
      recipientSameAsBuyer: false,
      recipientName: "",
      recipientPhone: "",
      recipientPostalCode: "",
      recipientAddress: "",
      recipientAddressDetail: "",
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.recipientName).toBeDefined();
      expect(result.errors.recipientAddress).toBeDefined();
    }
  });

  it("allows empty recipient address detail", () => {
    const result = validateContractForm({
      ...validFormValues,
      recipientAddressDetail: "",
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.recipientAddressDetail).toBe("");
    }
  });

  it("requires cash receipt details for bank transfer", () => {
    const result = validateContractForm({
      ...validFormValues,
      paymentMethod: "bank_transfer",
      cashReceiptType: "income_deduction",
      cashReceiptPhone: "",
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.cashReceiptPhone).toBeDefined();
    }
  });

  it("accepts tax invoice instead of cash receipt for bank transfer", () => {
    const result = validateContractForm({
      ...validFormValues,
      paymentMethod: "bank_transfer",
      cashReceiptType: "",
      taxInvoiceRequested: true,
      taxInvoiceEmail: "tax@example.com",
    });

    expect(result.valid).toBe(true);
  });

  it("rejects selecting cash receipt and tax invoice together", () => {
    const result = validateContractForm({
      ...validFormValues,
      paymentMethod: "bank_transfer",
      cashReceiptType: "income_deduction",
      cashReceiptPhone: "010-1234-5678",
      taxInvoiceRequested: true,
      taxInvoiceEmail: "tax@example.com",
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.taxInvoiceRequested).toBe(
        "현금영수증과 세금계산서는 중복 선택할 수 없습니다.",
      );
    }
  });

  it("rejects when terms are not agreed", () => {
    const result = validateContractForm({
      ...validFormValues,
      termsAgreed: false,
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.termsAgreed).toBe(
        "개인정보 수집·이용에 동의해야 합니다.",
      );
    }
  });
});
