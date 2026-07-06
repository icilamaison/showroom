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
  recipientAddress: "",
  products: createEmptyProductRows().map((product, index) =>
    index === 0
      ? {
          ...product,
          name: "프리미엄 침구 세트",
          color: "아이보리",
          size: "Q",
          quantity: "1",
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
  termsAgreed: true,
};

describe("validateContractForm", () => {
  it("accepts valid form values", () => {
    const result = validateContractForm(validFormValues);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.buyerName).toBe("홍길동");
      expect(result.data.writtenDate).toBe("2026-06-24");
      expect(result.data.agreementDate).toBe("2026-06-24");
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

  it("requires recipient details when not same as buyer", () => {
    const result = validateContractForm({
      ...validFormValues,
      recipientSameAsBuyer: false,
      recipientName: "",
      recipientPhone: "",
      recipientAddress: "",
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.recipientName).toBeDefined();
      expect(result.errors.recipientAddress).toBeDefined();
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

  it("rejects when terms are not agreed", () => {
    const result = validateContractForm({
      ...validFormValues,
      termsAgreed: false,
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.termsAgreed).toBe("동의 내용에 체크해야 합니다.");
    }
  });
});
