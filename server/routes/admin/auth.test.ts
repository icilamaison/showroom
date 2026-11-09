import "dotenv/config";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../index";
import { MAX_FAILED_LOGINS } from "./auth";

const app = createApp();

describe("POST /api/admin/login 실패 제한", () => {
  it("같은 아이디로 연속 실패하면 올바른 비밀번호도 429로 막는다", async () => {
    const username = `lock-test-${Date.now()}`;

    for (let i = 0; i < MAX_FAILED_LOGINS; i += 1) {
      const res = await request(app)
        .post("/api/admin/login")
        .send({ username, password: "wrong" });
      expect(res.status).toBe(401);
    }

    const locked = await request(app)
      .post("/api/admin/login")
      .send({ username, password: "wrong" });
    expect(locked.status).toBe(429);

    // 다른 아이디는 영향 없음
    const other = await request(app)
      .post("/api/admin/login")
      .send({ username: `${username}-other`, password: "wrong" });
    expect(other.status).toBe(401);
  });
});
