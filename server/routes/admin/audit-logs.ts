import { Router } from "express";
import { sendError, sendSuccess } from "../../lib/api-response";
import { listAuditLogs, recordAudit, getRequestIp } from "../../services/audit.service";

const auditLogsRouter = Router();

// 주 1회 이상 관리자가 이상 로그인·대량 조회·엑셀 다운로드를 본다
auditLogsRouter.get("/", async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 100);
    const action = typeof req.query.action === "string" ? req.query.action : undefined;
    const items = await listAuditLogs({
      limit: Number.isFinite(limit) ? limit : 100,
      action,
    });

    recordAudit({
      actorType: "admin",
      actorId: req.admin?.adminId,
      actorLabel: req.admin?.username,
      action: "audit.list",
      ip: getRequestIp(req),
      meta: { limit: items.length, filterAction: action ?? null },
    });

    return sendSuccess(res, { items });
  } catch (error) {
    console.error("[admin/audit-logs] Failed to list:", error);
    return sendError(res, "서버 오류가 발생했습니다.", 500);
  }
});

export default auditLogsRouter;
