import { Router } from "express";
import { sendError, sendSuccess } from "../../lib/api-response";
import { parseAdminLoginInput } from "../../schemas/admin.schema";
import {
  ADMIN_TOKEN_COOKIE,
  authenticateAdmin,
  signAdminToken,
} from "../../services/auth.service";

const authRouter = Router();

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

authRouter.post("/", async (req, res) => {
  const parsed = parseAdminLoginInput(req.body);

  if (!parsed.success) {
    return sendError(res, parsed.message, 400);
  }

  const admin = await authenticateAdmin(
    parsed.data.username,
    parsed.data.password,
  );

  if (!admin) {
    return sendError(res, "아이디 또는 비밀번호가 올바르지 않습니다.", 401);
  }

  const token = signAdminToken(admin);

  res.cookie(ADMIN_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ONE_DAY_MS,
  });

  return sendSuccess(res, { username: admin.username });
});

export default authRouter;
