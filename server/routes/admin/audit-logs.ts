import { Router } from "express";
import { canViewAuditLogs } from "../../../lib/audit-access";
import { sendError, sendSuccess } from "../../lib/api-response";
import { listAuditLogs, recordAudit, getRequestIp } from "../../services/audit.service";

const auditLogsRouter = Router();

// 주 1회 확인용. kimhi1105(개발자)만 목록을 볼 수 있다.
auditLogsRouter.get("/", async (req, res) => {
  if (!canViewAuditLogs(req.admin?.username)) {
    return sendError(res, "감사 로그 조회 권한이 없습니다.", 403);
  }

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
