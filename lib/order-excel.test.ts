import { describe, expect, it } from "vitest";
import { createEmptyProductRows } from "./validation/contract";
import {
  buildOrderExcelRows,
  findMissingOrderExcelRequiredFields,
  formatShoppingMallOrderNumber,
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
      type: "라이트타입 1.5cm",
      color: "블랙",
      size: "L",
      quantity: "2",
      unitPrice: "50000",
      remarks: "문 앞에 놔주세요",
    };
    products[1] = {
      name: "추가 상품",
      type: "",
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
      "쇼핑몰주문번호": "",
      "주문자명": "홍길동",
      "주문자ID": "",
      "주문자휴대폰번호": "010-1234-5678",
      "수령자명": "김수령",
      "수령자휴대폰번호": "010-9999-8888",
      "우편번호": "06234",
      "주소": "서울시 강남구 테헤란로 1 101동 1001호",
      "온라인 상품명": "테스트 상품",
      "옵션명": "TYPE=라이트타입 1.5cm, COLOR=블랙, SIZE=L",
      "주문수량": "2",
      "금액": "50000",
      "배송메세지": "문 앞에 놔주세요",
      "주문일": "2026-07-01",
      "국가코드": "KR",
    });
    expect(rows[1]["온라인 상품명"]).toBe("추가 상품");
    expect(rows[1]["옵션명"]).toBe("COLOR=화이트");
    expect(rows[1]["금액"]).toBe("30000");
    expect(rows[1]["배송메세지"]).toBe("");
  });

  it("uses the approval number as the shopping mall order number", () => {
    const products = createEmptyProductRows();
    products[0] = {
      name: "테스트 상품",
      type: "",
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

  it("formats approval numbers with an SR prefix", () => {
    expect(formatShoppingMallOrderNumber("546450")).toBe("SR546450");
    expect(formatShoppingMallOrderNumber("SR546450")).toBe("SR546450");
    expect(formatShoppingMallOrderNumber("")).toBe("");
    expect(formatShoppingMallOrderNumber("abc")).toBe("");
  });

  it("exports grouped selections as the real Cafe24 product and option", () => {
    const products = createEmptyProductRows();
    const row = { quantity: "1", unitPrice: "1000", remarks: "" };
    products[0] = { ...row, name: "슬록 8colors", type: "모노타입", color: "아이보리", size: "1호 160X240" };
    products[1] = { ...row, name: "뉴슬록 3colors", type: "", color: "아이보리", size: "미니 100X150" };
    products[2] = { ...row, name: "그레인 매트", type: "", color: "샌드브라운", size: "M 48X120" };
    products[3] = { ...row, name: "플루아 블랭킷", type: "", color: "블랙", size: "L 100X150" };
    products[4] = { ...row, name: "샤인 4colors", type: "", color: "브라운", size: "원형 200" };

    const rows = buildOrderExcelRows({
      ...basePayload,
      products,
    });

    expect(rows.map((r) => [r["온라인 상품명"], r["옵션명"]])).toEqual([
      ["슬록 1호 160X240", "TYPE=모노타입, COLOR=아이보리 1호 160X240"],
      ["뉴슬록 3colors", "COLOR=아이보리 미니 100X150"],
      ["그레인 매트 샌드브라운", "SIZE=M 48X120"],
      ["플루아 블랭킷 블랙", "SIZE=블랙 L 100X150"],
      ["샤인 원형 200", "COLOR=브라운"],
    ]);
  });

  it("puts set component options into the option name", () => {
    const products = createEmptyProductRows();
    products[0] = {
      name: "쿨포터 세트",
      type: "",
      color: "COLOR=화이트 K 180X205 + 화이트 QK겸용 200X210 + 50X70",
      size: "",
      quantity: "1",
      unitPrice: "150000",
      remarks: "문 앞에 놔주세요",
    };

    const rows = buildOrderExcelRows({
      ...basePayload,
      products,
    });

    expect(rows[0]["온라인 상품명"]).toBe("쿨포터 세트");
    expect(rows[0]["옵션명"]).toBe(
      "COLOR=화이트 K 180X205, 화이트 QK겸용 200X210, 50X70",
    );
    expect(rows[0]["배송메세지"]).toBe("문 앞에 놔주세요");
  });

  it("writes catalog set options per component like the Cafe24 order list", () => {
    const products = createEmptyProductRows();
    products[0] = {
      name: "[SET] 퍼즈필+비건구스필+본느윗 베딩 6colors",
      type: "",
      color:
        "COLOR=화이트 SS 160X210, 50X70, 세레니티 SS 160X210, 세레니티 / 50X70, 크림화이트 SS 110X210",
      size: "",
      quantity: "1",
      unitPrice: "392490",
      remarks: "",
    };

    const rows = buildOrderExcelRows({
      ...basePayload,
      products,
    });

    expect(rows[0]["옵션명"]).toBe(
      "[세트][SET] 퍼즈필+비건구스필+본느윗 베딩 6colors" +
        "퍼즈필 독일 이불솜(1개) - COLOR=화이트 SS 160X210" +
        "비건구스필 베개솜(1개) - SIZE=50X70" +
        "본느윗 이불커버 6colors(1개) - COLOR=세레니티 SS 160X210" +
        "본느윗 베개커버 6colors(1개) - COLOR=세레니티 - SIZE=50X70" +
        "본느윗 패드 6colors(1개) - COLOR=크림화이트 SS 110X210",
    );
  });

  it("uses buyer info when recipient is the same as buyer", () => {
    const products = createEmptyProductRows();
    products[0] = {
      name: "단일 상품",
      type: "",
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
      type: "",
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
