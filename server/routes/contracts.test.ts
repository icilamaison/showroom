import "dotenv/config";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createEmptyProductRows } from "../../lib/validation/contract";
import { pool } from "../db/pool";
import { createApp } from "../index";

const app = createApp();

const validPayload = {
  managerName: "김담당",
  writtenDateYear: "2026",
  writtenDateMonth: "6",
  writtenDateDay: "24",
  buyerName: "홍길동",
  buyerPhone: "010-9999-0001",
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
  termsAgreed: true,
};

function uniquePayload(phoneSuffix: string) {
  return {
    ...validPayload,
    buyerPhone: `010-9999-${phoneSuffix}`,
    buyerName: `테스트${phoneSuffix}`,
    signatureName: `테스트${phoneSuffix}`,
  };
}

describe("POST /api/contracts", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("returns 201 with contract number for valid submission (AC-1)", async () => {
    const payload = uniquePayload("1001");

    const response = await request(app)
      .post("/api/contracts")
      .send(payload)
      .expect(201);

    expect(response.body).toEqual({
      success: true,
      data: {
        contractNumber: expect.stringMatching(/^CT-\d{8}-\d{4}$/),
        status: "SUBMITTED",
      },
    });
  });

  it("returns 400 with field errors for invalid submission (AC-1)", async () => {
    const response = await request(app)
      .post("/api/contracts")
      .send({
        ...validPayload,
        buyerPhone: "invalid-phone",
        recipientSameAsBuyer: false,
        recipientAddress: "",
        termsAgreed: true,
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("입력값을 확인해주세요.");
    expect(response.body.errors.buyerPhone).toBeDefined();
    expect(response.body.errors.recipientAddress).toBeDefined();
  });

  it("stores contract data and payload in the database (AC-2)", async () => {
    const payload = uniquePayload("1002");

    const response = await request(app)
      .post("/api/contracts")
      .send(payload)
      .expect(201);

    const { contractNumber } = response.body.data;

    const dbResult = await pool.query(
      `SELECT customer_name, customer_phone, status, payload
       FROM contracts
       WHERE contract_number = $1`,
      [contractNumber],
    );

    expect(dbResult.rowCount).toBe(1);
    expect(dbResult.rows[0]).toMatchObject({
      customer_name: payload.buyerName,
      customer_phone: payload.buyerPhone,
      status: "SUBMITTED",
    });
    expect(dbResult.rows[0].payload).toMatchObject({
      buyerName: payload.buyerName,
      paymentMethod: "card",
      writtenDate: "2026-06-24",
    });
  });

  it("generates different contract numbers for duplicate submissions (AC-1)", async () => {
    const payload = uniquePayload("1003");

    const first = await request(app)
      .post("/api/contracts")
      .send(payload)
      .expect(201);

    const second = await request(app)
      .post("/api/contracts")
      .send(payload)
      .expect(201);

    expect(first.body.data.contractNumber).not.toBe(
      second.body.data.contractNumber,
    );
  });
});
