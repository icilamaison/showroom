import "dotenv/config";
import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUDIT_LOG_VIEWER_USERNAME } from "../../lib/audit-access";
import { pool } from "../db/pool";
import { createApp } from "../index";
import { listAuditLogs, writeAuditLog } from "./audit.service";
import { ADMIN_TOKEN_COOKIE } from "./auth.service";

const app = createApp();

const adminCredentials = {
  username: process.env.ADMIN_SEED_USERNAME ?? "admin",
  password: process.env.ADMIN_SEED_PASSWORD ?? "admin1234",
};

const auditViewerCredentials = {
  username: AUDIT_LOG_VIEWER_USERNAME,
  password: "a",
};

describe("audit logs", () => {
  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(auditViewerCredentials.password, 10);
    const existing = await pool.query<{ id: number }>(
      "SELECT id FROM admins WHERE username = $1",
      [AUDIT_LOG_VIEWER_USERNAME],
    );

    if (existing.rowCount && existing.rowCount > 0) {
      await pool.query("UPDATE admins SET password_hash = $1 WHERE username = $2", [
        passwordHash,
        AUDIT_LOG_VIEWER_USERNAME,
      ]);
    } else {
      await pool.query(
        "INSERT INTO admins (username, password_hash, name) VALUES ($1, $2, $3)",
        [AUDIT_LOG_VIEWER_USERNAME, passwordHash, "개발자"],
      );
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it("persists and lists audit entries", async () => {
    await writeAuditLog({
      actorType: "admin",
      actorLabel: "audit-test",
      action: "audit.self_test",
      success: true,
      meta: { probe: true },
    });

    const items = await listAuditLogs({ action: "audit.self_test", limit: 5 });
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]?.action).toBe("audit.self_test");
    expect(items[0]?.actorLabel).toBe("audit-test");
  });

  it("denies audit list to normal admins", async () => {
    const agent = request.agent(app);
    await agent.post("/api/admin/login").send(adminCredentials).expect(200);

    const logs = await agent.get("/api/admin/audit-logs");
    expect(logs.status).toBe(403);
  });

  it("records login success and exposes list to audit viewer only", async () => {
    const agent = request.agent(app);

    const login = await agent
      .post("/api/admin/login")
      .send(auditViewerCredentials);
    expect(login.status).toBe(200);
    expect(login.headers["set-cookie"]?.[0]).toContain(`${ADMIN_TOKEN_COOKIE}=`);

    // fire-and-forget insert가 끝날 시간을 잠깐 준다
    await new Promise((resolve) => setTimeout(resolve, 100));

    const logs = await agent.get("/api/admin/audit-logs?action=admin.login&limit=20");
    expect(logs.status).toBe(200);
    expect(logs.body.success).toBe(true);
    expect(
      logs.body.data.items.some(
        (item: { action: string; success: boolean; actorLabel: string }) =>
          item.action === "admin.login" &&
          item.success === true &&
          item.actorLabel === auditViewerCredentials.username,
      ),
    ).toBe(true);
  });
});
