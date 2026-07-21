import { describe, expect, it } from "vitest";
import { createEmptyProductRows } from "../../lib/validation/contract";
import { parseContractInput } from "./contract.schema";

const validInput = {
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

describe("parseContractInput", () => {
  it("accepts valid input", () => {
    const result = parseContractInput(validInput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.buyerName).toBe("홍길동");
      expect(result.data.customerName).toBe("홍길동");
      expect(result.data.productName).toBe("프리미엄 침구 세트");
      expect(result.data.termsAgreed).toBe(true);
      expect(result.data.writtenDate).toBe("2026-06-24");
      expect(result.data.signatureDataUrl).toBe("data:image/png;base64,test");
    }
  });

  it("rejects missing required fields", () => {
    const result = parseContractInput({
      ...validInput,
      buyerName: "",
      products: createEmptyProductRows(),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.buyerName).toBeDefined();
      expect(result.errors.products).toBeDefined();
    }
  });

  it("rejects invalid phone format", () => {
    const result = parseContractInput({
      ...validInput,
      buyerPhone: "01012345678",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.buyerPhone).toBe(
        "연락처는 010-0000-0000 형식으로 입력해주세요.",
      );
    }
  });

  it("rejects missing drawn signature", () => {
    const result = parseContractInput({
      ...validInput,
      signatureDataUrl: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.signatureDataUrl).toBe("서명을 입력해주세요.");
    }
  });

  it("rejects when recipient details are missing", () => {
    const result = parseContractInput({
      ...validInput,
      recipientSameAsBuyer: false,
      recipientAddress: "",
      recipientAddressDetail: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.recipientAddress).toBeDefined();
    }
  });

  it("accepts empty recipient address detail", () => {
    const result = parseContractInput({
      ...validInput,
      recipientAddressDetail: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.recipientAddressDetail).toBe("");
    }
  });

  it("rejects when termsAgreed is false", () => {
    const result = parseContractInput({
      ...validInput,
      termsAgreed: false,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.termsAgreed).toBe(
        "개인정보 수집·이용에 동의해야 합니다.",
      );
    }
  });

  it("rejects selecting cash receipt and tax invoice together", () => {
    const result = parseContractInput({
      ...validInput,
      paymentMethod: "bank_transfer",
      cashReceiptType: "income_deduction",
      cashReceiptPhone: "010-1234-5678",
      taxInvoiceRequested: true,
      taxInvoiceEmail: "tax@example.com",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.taxInvoiceRequested).toBe(
        "현금영수증과 세금계산서는 중복 선택할 수 없습니다.",
      );
    }
  });
});
