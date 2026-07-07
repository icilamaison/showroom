import "dotenv/config";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createEmptyProductRows } from "../../../lib/validation/contract";
import { pool } from "../../db/pool";
import { createApp } from "../../index";
import { ADMIN_TOKEN_COOKIE } from "../../services/auth.service";

const app = createApp();

const adminCredentials = {
  username: process.env.ADMIN_SEED_USERNAME ?? "admin",
  password: process.env.ADMIN_SEED_PASSWORD ?? "admin1234",
};

const contractPayload = {
  managerName: "",
  writtenDateYear: "2026",
  writtenDateMonth: "7",
  writtenDateDay: "1",
  buyerName: "관리자테스트",
  buyerPhone: "010-8888-2001",
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
          name: "테스트 상품",
          quantity: "1",
          unitPrice: "10000",
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
  agreementDateMonth: "7",
  agreementDateDay: "1",
  termsAgreed: true,
  signatureName: "관리자테스트",
};

async function createTestContract(phoneSuffix: string, customerName: string) {
  const payload = {
    ...contractPayload,
    buyerPhone: `010-8888-${phoneSuffix}`,
    buyerName: customerName,
    signatureName: customerName,
  };

  const response = await request(app).post("/api/contracts").send(payload);

  return {
    payload,
    contractId: null as number | null,
    contractNumber: response.body.data.contractNumber as string,
  };
}

async function loginAgent() {
  const agent = request.agent(app);

  await agent
    .post("/api/admin/login")
    .send(adminCredentials)
    .expect(200);

  return agent;
}

describe("Admin API", () => {
  describe("POST /api/admin/login (AC-3)", () => {
    it("returns 200 and sets auth cookie for valid credentials", async () => {
      const response = await request(app)
        .post("/api/admin/login")
        .send(adminCredentials)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: { username: adminCredentials.username },
      });
      expect(response.headers["set-cookie"]?.[0]).toContain(
        `${ADMIN_TOKEN_COOKIE}=`,
      );
    });

    it("returns 401 for invalid credentials", async () => {
      const response = await request(app)
        .post("/api/admin/login")
        .send({
          username: adminCredentials.username,
          password: "wrong-password",
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.headers["set-cookie"]).toBeUndefined();
    });
  });

  describe("GET /api/admin/contracts (AC-3, AC-4)", () => {
    it("returns 401 without authentication", async () => {
      const response = await request(app).get("/api/admin/contracts").expect(401);

      expect(response.body.success).toBe(false);
    });

    it("returns contracts sorted by latest createdAt", async () => {
      const agent = await loginAgent();
      const response = await agent.get("/api/admin/contracts").expect(200);

      const items = response.body.data.items;
      expect(items.length).toBeGreaterThan(0);

      for (let index = 0; index < items.length - 1; index += 1) {
        const current = new Date(items[index].createdAt).getTime();
        const next = new Date(items[index + 1].createdAt).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });

    it("filters by customerName", async () => {
      await createTestContract("2002", "검색고객");

      const agent = await loginAgent();
      const response = await agent
        .get("/api/admin/contracts")
        .query({ customerName: "검색고객" })
        .expect(200);

      expect(response.body.data.items.length).toBeGreaterThan(0);
      expect(
        response.body.data.items.every((item: { customerName: string }) =>
          item.customerName.includes("검색고객"),
        ),
      ).toBe(true);
    });

    it("filters by status", async () => {
      const created = await createTestContract("2003", "상태필터");

      const agent = await loginAgent();
      const response = await agent
        .get("/api/admin/contracts")
        .query({ status: "SUBMITTED" })
        .expect(200);

      expect(
        response.body.data.items.some(
          (item: { contractNumber: string }) =>
            item.contractNumber === created.contractNumber,
        ),
      ).toBe(true);
      expect(
        response.body.data.items.every(
          (item: { status: string }) => item.status === "SUBMITTED",
        ),
      ).toBe(true);
    });

    it("applies multiple filters with AND condition", async () => {
      await createTestContract("2004", "복합검색");

      const agent = await loginAgent();
      const response = await agent
        .get("/api/admin/contracts")
        .query({ customerName: "복합검색", status: "SUBMITTED" })
        .expect(200);

      expect(response.body.data.items.length).toBeGreaterThan(0);
      expect(
        response.body.data.items.every(
          (item: { customerName: string; status: string }) =>
            item.customerName.includes("복합검색") &&
            item.status === "SUBMITTED",
        ),
      ).toBe(true);
    });
  });

  describe("GET /api/admin/contracts/:id (AC-5)", () => {
    it("returns full contract detail", async () => {
      const created = await createTestContract("2005", "상세조회");

      const idResult = await pool.query<{ id: number }>(
        "SELECT id FROM contracts WHERE contract_number = $1",
        [created.contractNumber],
      );
      const contractId = idResult.rows[0].id;

      const agent = await loginAgent();
      const response = await agent
        .get(`/api/admin/contracts/${contractId}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: contractId,
        contractNumber: created.contractNumber,
        customerName: "상세조회",
        customerPhone: "010-8888-2005",
        customerAddress: "서울시 강남구 테헤란로 1 101동 1001호",
        productName: "테스트 상품",
        contractAmount: 10000,
        contractStartDate: "2026-07-01",
        contractEndDate: "2026-07-01",
        termsAgreed: true,
        signatureName: "상세조회",
        status: "SUBMITTED",
      });
      expect(response.body.data.payload).toBeDefined();
      expect(response.body.data.createdAt).toBeDefined();
      expect(response.body.data.updatedAt).toBeDefined();
    });
  });

  describe("PATCH /api/admin/contracts/:id/status (AC-6)", () => {
    it("updates status and updated_at in the database", async () => {
      const created = await createTestContract("2006", "상태변경");

      const idResult = await pool.query<{ id: number; updated_at: Date }>(
        "SELECT id, updated_at FROM contracts WHERE contract_number = $1",
        [created.contractNumber],
      );
      const contractId = idResult.rows[0].id;
      const previousUpdatedAt = idResult.rows[0].updated_at;

      const agent = await loginAgent();
      await agent
        .patch(`/api/admin/contracts/${contractId}/status`)
        .send({ status: "CONFIRMED" })
        .expect(200);

      const dbResult = await pool.query<{ status: string; updated_at: Date }>(
        "SELECT status, updated_at FROM contracts WHERE id = $1",
        [contractId],
      );

      expect(dbResult.rows[0].status).toBe("CONFIRMED");
      expect(dbResult.rows[0].updated_at.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt.getTime(),
      );
    });

    it("reflects updated status in the list response", async () => {
      const created = await createTestContract("2007", "목록반영");

      const idResult = await pool.query<{ id: number }>(
        "SELECT id FROM contracts WHERE contract_number = $1",
        [created.contractNumber],
      );
      const contractId = idResult.rows[0].id;

      const agent = await loginAgent();
      await agent
        .patch(`/api/admin/contracts/${contractId}/status`)
        .send({ status: "REVIEWING" })
        .expect(200);

      const listResponse = await agent
        .get("/api/admin/contracts")
        .query({ customerName: "목록반영" })
        .expect(200);

      expect(listResponse.body.data.items[0].status).toBe("REVIEWING");
    });

    it("returns 400 for invalid status values", async () => {
      const agent = await loginAgent();
      const response = await agent
        .patch("/api/admin/contracts/1/status")
        .send({ status: "INVALID_STATUS" })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/admin/contracts/:id/order-excel", () => {
    it("returns an Excel file for purchase contract payloads", async () => {
      const created = await createTestContract("2008", "엑셀다운");

      const idResult = await pool.query<{ id: number }>(
        "SELECT id FROM contracts WHERE contract_number = $1",
        [created.contractNumber],
      );
      const contractId = idResult.rows[0].id;

      const agent = await loginAgent();
      const response = await agent
        .get(`/api/admin/contracts/${contractId}/order-excel`)
        .expect(200);

      expect(response.headers["content-type"]).toContain(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      expect(response.headers["content-disposition"]).toContain(
        "playauto_order_",
      );
      expect(Number(response.headers["content-length"])).toBeGreaterThan(0);
    });

    it("returns 401 without admin authentication", async () => {
      await request(app).get("/api/admin/contracts/1/order-excel").expect(401);
    });
  });

  describe("GET /api/admin/contracts/order-excel", () => {
    it("returns a bulk Excel file for filtered contracts", async () => {
      await createTestContract("2009", "엑셀일괄");

      const agent = await loginAgent();
      const response = await agent
        .get("/api/admin/contracts/order-excel")
        .query({ customerName: "엑셀일괄" })
        .expect(200);

      expect(response.headers["content-type"]).toContain(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      expect(response.headers["content-disposition"]).toContain(
        "playauto_orders_",
      );
      expect(Number(response.headers["content-length"])).toBeGreaterThan(0);
    });

    it("returns 400 for invalid date range", async () => {
      const agent = await loginAgent();
      const response = await agent
        .get("/api/admin/contracts/order-excel")
        .query({ dateFrom: "2026-07-10", dateTo: "2026-07-01" })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});
