import { Router } from "express";
import { sendError, sendSuccess } from "../../lib/api-response";
import { parseAdminLoginInput } from "../../schemas/admin.schema";
import {
  ADMIN_COOKIE_OPTIONS,
  ADMIN_TOKEN_COOKIE,
  authenticateAdmin,
  signAdminToken,
} from "../../services/auth.service";

const authRouter = Router();

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// 비밀번호 무차별 대입 방지: 같은 아이디로 15분 안에 5번 틀리면 마지막 실패부터 15분 잠금.
// IP가 아닌 아이디 기준인 이유: 운영은 Vercel 프록시를 거쳐 들어와 고객별 IP 구분을 믿을 수 없다.
// ponytail: 서버 메모리 기준이라 재시작하면 초기화되고, Cloud Run 인스턴스가 여러 개면 인스턴스마다 따로 센다. 부족해지면 DB에 기록
export const MAX_FAILED_LOGINS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const failedLogins = new Map<string, { count: number; resetAt: number }>();

function isLoginLocked(username: string, now: number): boolean {
  const entry = failedLogins.get(username);
  return Boolean(entry && entry.count >= MAX_FAILED_LOGINS && now < entry.resetAt);
}

function recordFailedLogin(username: string, now: number): void {
  // 없는 아이디를 대량으로 보내 메모리를 채우지 못하게 만료된 기록은 정리
  if (failedLogins.size > 1000) {
    for (const [key, entry] of failedLogins) {
      if (now >= entry.resetAt) failedLogins.delete(key);
    }
  }

  const entry = failedLogins.get(username);
  if (!entry || now >= entry.resetAt) {
    failedLogins.set(username, { count: 1, resetAt: now + LOGIN_LOCK_MS });
    return;
  }

  entry.count += 1;
  entry.resetAt = now + LOGIN_LOCK_MS;
}

authRouter.post("/", async (req, res) => {
  const parsed = parseAdminLoginInput(req.body);

  if (!parsed.success) {
    return sendError(res, parsed.message, 400);
  }

  const { username, password } = parsed.data;

  if (isLoginLocked(username, Date.now())) {
    return sendError(
      res,
      "로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.",
      429,
    );
  }

  const admin = await authenticateAdmin(username, password);

  if (!admin) {
    recordFailedLogin(username, Date.now());
    return sendError(res, "아이디 또는 비밀번호가 올바르지 않습니다.", 401);
  }

  failedLogins.delete(username);

  const token = signAdminToken(admin);

  res.cookie(ADMIN_TOKEN_COOKIE, token, {
    ...ADMIN_COOKIE_OPTIONS,
    maxAge: ONE_DAY_MS,
  });

  return sendSuccess(res, { username: admin.username });
});

export default authRouter;
