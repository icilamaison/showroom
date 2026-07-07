import { describe, expect, it } from "vitest";
import { createEmptyProductRows } from "./validation/contract";
import {
  buildOrderExcelRows,
  findMissingOrderExcelRequiredFields,
  ORDER_EXCEL_REQUIRED_FIELDS,
} from "./order-excel";

const basePayload = {
  managerName: "담당자",
  writtenDateYear: "2026",
  writtenDateMonth: "7",
  writtenDateDay: "1",
  buyerName: "홍길동",
  buyerPhone: "010-1234-5678",
  recipientSameAsBuyer: false,
  recipientName: "김수령",
  recipientPhone: "010-9999-8888",
  recipientPostalCode: "06234",
  recipientAddress: "서울시 강남구 테헤란로 1",
  recipientAddressDetail: "101동 1001호",
  paymentMethod: "card" as const,
  cashReceiptType: "" as const,
  cashReceiptPhone: "",
  cashReceiptBusinessNumber: "",
  taxInvoiceRequested: false,
  taxInvoiceEmail: "",
  agreementDateYear: "2026",
  agreementDateMonth: "7",
  agreementDateDay: "1",
  signatureName: "홍길동",
  termsAgreed: true as const,
  writtenDate: "2026-07-01",
  agreementDate: "2026-07-01",
};

describe("buildOrderExcelRows", () => {
  it("maps purchase contract data into PlayAuto order rows", () => {
    const products = createEmptyProductRows();
    products[0] = {
      name: "테스트 상품",
      color: "블랙",
      size: "L",
      quantity: "2",
      unitPrice: "50000",
      remarks: "문 앞에 놔주세요",
    };
    products[1] = {
      name: "추가 상품",
      color: "화이트",
      size: "",
      quantity: "1",
      unitPrice: "30000",
      remarks: "",
    };

    const rows = buildOrderExcelRows(
      {
        ...basePayload,
        products,
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
      "우편번호": "06234",
      "주소": "서울시 강남구 테헤란로 1 101동 1001호",
      "온라인 상품명": "테스트 상품",
      "옵션명": "블랙,L",
      "주문수량": "2",
      "금액": "50000",
      "배송메세지": "문 앞에 놔주세요",
      "주문일": "2026-07-01",
      "국가코드": "KR",
    });
    expect(rows[1]["온라인 상품명"]).toBe("추가 상품");
    expect(rows[1]["금액"]).toBe("30000");
  });

  it("uses buyer info when recipient is the same as buyer", () => {
    const products = createEmptyProductRows();
    products[0] = {
      name: "단일 상품",
      color: "",
      size: "",
      quantity: "1",
      unitPrice: "12000",
      remarks: "",
    };

    const rows = buildOrderExcelRows(
      {
        ...basePayload,
        recipientSameAsBuyer: true,
        recipientName: "",
        recipientPhone: "",
        products,
      },
      "CT-20260701-0002",
    );

    expect(rows[0]["수령자명"]).toBe("홍길동");
    expect(rows[0]["수령자휴대폰번호"]).toBe("010-1234-5678");
    expect(rows[0]["우편번호"]).toBe("06234");
    expect(rows[0]["주소"]).toBe("서울시 강남구 테헤란로 1 101동 1001호");
    expect(rows[0]["금액"]).toBe("12000");
  });
});

describe("findMissingOrderExcelRequiredFields", () => {
  it("returns empty list when all required fields are filled", () => {
    const products = createEmptyProductRows();
    products[0] = {
      name: "단일 상품",
      color: "",
      size: "",
      quantity: "1",
      unitPrice: "12000",
      remarks: "",
    };

    const rows = buildOrderExcelRows(
      {
        ...basePayload,
        products,
      },
      "CT-20260701-0003",
    );

    expect(findMissingOrderExcelRequiredFields(rows)).toEqual([]);
    expect(ORDER_EXCEL_REQUIRED_FIELDS).toContain("금액");
  });

  it("reports missing required fields", () => {
    const row = Object.fromEntries(
      ORDER_EXCEL_REQUIRED_FIELDS.map((field) => [field, field === "주문자명" ? "" : "값"]),
    ) as Record<(typeof ORDER_EXCEL_REQUIRED_FIELDS)[number], string>;

    expect(findMissingOrderExcelRequiredFields([row as never])).toEqual([
      "주문자명",
    ]);
  });
});
