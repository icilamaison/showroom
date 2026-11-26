import { Router } from "express";
import { sendSuccess } from "../../lib/api-response";
import { requireAdminAuth } from "../../middleware/auth";
import {
  ADMIN_COOKIE_OPTIONS,
  ADMIN_TOKEN_COOKIE,
  verifyAdminToken,
} from "../../services/auth.service";
import { getRequestIp, recordAudit } from "../../services/audit.service";
import authRouter from "./auth";
import auditLogsRouter from "./audit-logs";
import contractsRouter from "./contracts";

const adminRouter = Router();

adminRouter.use("/login", authRouter);
adminRouter.post("/logout", (req, res) => {
  // logout은 비로그인도 쿠키 지울 수 있게 열어 둔다. 가능하면 토큰에서 행위자만 읽는다.
  let actorId: number | undefined;
  let actorLabel: string | undefined;
  const token = req.cookies?.[ADMIN_TOKEN_COOKIE] as string | undefined;
  if (token) {
    try {
      const admin = verifyAdminToken(token);
      actorId = admin.adminId;
      actorLabel = admin.username;
    } catch {
      // 만료·위조 토큰이어도 쿠키는 지운다
    }
  }

  recordAudit({
    actorType: actorId ? "admin" : "anonymous",
    actorId,
    actorLabel,
    action: "admin.logout",
    ip: getRequestIp(req),
  });
  res.clearCookie(ADMIN_TOKEN_COOKIE, ADMIN_COOKIE_OPTIONS);
  return sendSuccess(res, null);
});
adminRouter.use(requireAdminAuth);
adminRouter.use("/audit-logs", auditLogsRouter);
adminRouter.use("/contracts", contractsRouter);

export default adminRouter;
