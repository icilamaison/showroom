import { describe, expect, it } from "vitest";
import { createEmptyProductRows } from "./validation/contract";
import { buildOrderExcelRows } from "./order-excel";

describe("buildOrderExcelRows", () => {
  it("maps purchase contract data into PlayAuto order rows", () => {
    const products = createEmptyProductRows();
    products[0] = {
      name: "테스트 상품",
      color: "블랙",
      size: "L",
      quantity: "2",
      remarks: "문 앞에 놔주세요",
    };
    products[1] = {
      name: "추가 상품",
      color: "화이트",
      size: "",
      quantity: "1",
      remarks: "",
    };

    const rows = buildOrderExcelRows(
      {
        managerName: "담당자",
        writtenDateYear: "2026",
        writtenDateMonth: "7",
        writtenDateDay: "1",
        buyerName: "홍길동",
        buyerPhone: "010-1234-5678",
        recipientSameAsBuyer: false,
        recipientName: "김수령",
        recipientPhone: "010-9999-8888",
        recipientAddress: "서울시 강남구 테헤란로 1",
        products,
        paymentMethod: "card",
        cashReceiptType: "",
        cashReceiptPhone: "",
        cashReceiptBusinessNumber: "",
        taxInvoiceRequested: false,
        taxInvoiceEmail: "",
        agreementDateYear: "2026",
        agreementDateMonth: "7",
        agreementDateDay: "1",
        signatureName: "홍길동",
        termsAgreed: true,
        writtenDate: "2026-07-01",
        agreementDate: "2026-07-01",
      },
      "CT-20260701-0001",
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      "쇼핑몰주문번호": "auto",
      "주문자명": "홍길동",
      "주문자ID": "CT-20260701-0001",
      "주문자휴대폰번호": "010-1234-5678",
      "수령자명": "김수령",
      "수령자휴대폰번호": "010-9999-8888",
      "주소": "서울시 강남구 테헤란로 1",
      "온라인 상품명": "테스트 상품",
      "옵션명": "블랙,L",
      "주문수량": "2",
      "배송메세지": "문 앞에 놔주세요",
      "주문일": "2026-07-01",
      "국가코드": "KR",
    });
    expect(rows[1]["온라인 상품명"]).toBe("추가 상품");
    expect(rows[1]["옵션명"]).toBe("화이트");
  });

  it("uses buyer info when recipient is the same as buyer", () => {
    const products = createEmptyProductRows();
    products[0] = {
      name: "단일 상품",
      color: "",
      size: "",
      quantity: "1",
      remarks: "",
    };

    const rows = buildOrderExcelRows(
      {
        managerName: "",
        writtenDateYear: "2026",
        writtenDateMonth: "7",
        writtenDateDay: "1",
        buyerName: "이구매",
        buyerPhone: "010-2222-3333",
        recipientSameAsBuyer: true,
        recipientName: "",
        recipientPhone: "",
        recipientAddress: "",
        products,
        paymentMethod: "bank_transfer",
        cashReceiptType: "income_deduction",
        cashReceiptPhone: "010-2222-3333",
        cashReceiptBusinessNumber: "",
        taxInvoiceRequested: false,
        taxInvoiceEmail: "",
        agreementDateYear: "2026",
        agreementDateMonth: "7",
        agreementDateDay: "1",
        signatureName: "이구매",
        termsAgreed: true,
        writtenDate: "2026-07-01",
        agreementDate: "2026-07-01",
      },
      "CT-20260701-0002",
    );

    expect(rows[0]["수령자명"]).toBe("이구매");
    expect(rows[0]["수령자휴대폰번호"]).toBe("010-2222-3333");
    expect(rows[0]["주소"]).toBe("");
  });
});
