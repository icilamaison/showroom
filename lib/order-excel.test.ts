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

    const rows = buildOrderExcelRows({
      ...basePayload,
      products,
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      "쇼핑몰주문번호": "showroom",
      "주문자명": "홍길동",
      "주문자ID": "",
      "주문자휴대폰번호": "010-1234-5678",
      "수령자명": "김수령",
      "수령자휴대폰번호": "010-9999-8888",
      "우편번호": "06234",
      "주소": "서울시 강남구 테헤란로 1 101동 1001호",
      "온라인 상품명": "테스트 상품",
      "옵션명": "COLOR=블랙, SIZE=L",
      "주문수량": "2",
      "금액": "50000",
      "배송메세지": "",
      "주문일": "2026-07-01",
      "국가코드": "KR",
    });
    expect(rows[1]["온라인 상품명"]).toBe("추가 상품");
    expect(rows[1]["금액"]).toBe("30000");
    expect(rows[1]["배송메세지"]).toBe("");
  });

  it("uses the approval number as the shopping mall order number", () => {
    const products = createEmptyProductRows();
    products[0] = {
      name: "테스트 상품",
      color: "",
      size: "",
      quantity: "1",
      unitPrice: "10000",
      remarks: "",
    };

    const rows = buildOrderExcelRows(
      {
        ...basePayload,
        products,
      },
      "SR546450",
    );

    expect(rows[0]["쇼핑몰주문번호"]).toBe("SR546450");
  });

  it("keeps set product option names in the option column", () => {
    const products = createEmptyProductRows();
    products[0] = {
      name: "쿨포터 세트",
      color: "COLOR=화이트 K 180X205 + 화이트 QK겸용 200X210 + 50X70",
      size: "",
      quantity: "1",
      unitPrice: "150000",
      remarks: "P0000BST | should not appear",
    };

    const rows = buildOrderExcelRows({
      ...basePayload,
      products,
    });

    expect(rows[0]["옵션명"]).toBe(
      "COLOR=화이트 K 180X205 + 화이트 QK겸용 200X210 + 50X70",
    );
    expect(rows[0]["배송메세지"]).toBe("");
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

    const rows = buildOrderExcelRows({
      ...basePayload,
      recipientSameAsBuyer: true,
      recipientName: "",
      recipientPhone: "",
      products,
    });

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

    const rows = buildOrderExcelRows({
      ...basePayload,
      products,
    });

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
