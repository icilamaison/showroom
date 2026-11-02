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

  // 스키마에 없으면 제출 시 값이 빠져 계약서·PDF에 패드 구매 체크가 사라진다
  it("keeps slip pad purchase", () => {
    const result = parseContractInput({ ...validInput, padPurchased: true, padQuantity: "2" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.padPurchased).toBe(true);
      expect(result.data.padQuantity).toBe("2");
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

  it("requires rug notice signatures only for 3호/4호", () => {
    const withSize = (color: string) => ({
      ...validInput,
      products: validInput.products.map((product, index) =>
        index === 0 ? { ...product, color } : product,
      ),
    });

    const size3 = parseContractInput(withSize("크림베이지 3호 240X300"));
    expect(size3.success).toBe(false);
    if (!size3.success) {
      expect(size3.errors.largeRugNoticeAgreed).toBeDefined();
      expect(size3.errors.size4DeliveryAgreed).toBeUndefined();
    }

    const size4 = parseContractInput(withSize("크림베이지 4호 300X400"));
    expect(size4.success).toBe(false);
    if (!size4.success) {
      expect(size4.errors.largeRugNoticeAgreed).toBeDefined();
      expect(size4.errors.size4DeliveryAgreed).toBeDefined();
    }

    expect(parseContractInput(withSize("크림베이지 1.5호 180X240")).success).toBe(true);
    // 호 표기 없는 베르데 300X400도 4호
    const verde = parseContractInput(withSize("카멜 300X400"));
    expect(verde.success).toBe(false);
    if (!verde.success) {
      expect(verde.errors.largeRugNoticeAgreed).toBeDefined();
      expect(verde.errors.size4DeliveryAgreed).toBeDefined();
    }
    expect(parseContractInput(withSize("카멜 200X300")).success).toBe(true);

    // ORDER-MADE 3호급(240X320~350)은 교환·반품 불가만, 290X400은 4호
    const orderMade3 = parseContractInput(withSize("240X330 이하"));
    expect(orderMade3.success).toBe(false);
    if (!orderMade3.success) {
      expect(orderMade3.errors.largeRugNoticeAgreed).toBeDefined();
      expect(orderMade3.errors.size4DeliveryAgreed).toBeUndefined();
    }
    const orderMade4 = parseContractInput(withSize("290X400 이하"));
    expect(orderMade4.success).toBe(false);
    if (!orderMade4.success) {
      expect(orderMade4.errors.size4DeliveryAgreed).toBeDefined();
    }

    // 주문 제작은 사이즈와 무관하게 교환·반품 불가 체크(배송 동의는 없음)
    const orderMadeSmall = parseContractInput({
      ...withSize("150X200 이하"),
      products: validInput.products.map((product, index) =>
        index === 0 ? { ...product, name: "비벤디 ORDER-MADE", color: "크림베이지", size: "150X200 이하" } : product,
      ),
    });
    expect(orderMadeSmall.success).toBe(false);
    if (!orderMadeSmall.success) {
      expect(orderMadeSmall.errors.largeRugNoticeAgreed).toBeDefined();
      expect(orderMadeSmall.errors.size4DeliveryAgreed).toBeUndefined();
    }

    // 커튼 호수는 러그 사이즈가 아니다
    expect(parseContractInput(withSize("3호 / 민자")).success).toBe(true);
    expect(
      parseContractInput({
        ...withSize("크림베이지 4호 300X400"),
        largeRugNoticeAgreed: true,
        size4DeliveryAgreed: true,
      }).success,
    ).toBe(true);
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
