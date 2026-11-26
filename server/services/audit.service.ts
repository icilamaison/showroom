import type { Request } from "express";
import { pool } from "../db/pool";

export type AuditActorType = "admin" | "public" | "anonymous";

export type AuditEntry = {
  actorType: AuditActorType;
  actorId?: number | null;
  actorLabel?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: number | null;
  targetLabel?: string | null;
  ip?: string | null;
  success?: boolean;
  meta?: Record<string, unknown> | null;
};

export type AuditLogRow = {
  id: string;
  createdAt: string;
  actorType: string;
  actorId: number | null;
  actorLabel: string | null;
  action: string;
  targetType: string | null;
  targetId: number | null;
  targetLabel: string | null;
  ip: string | null;
  success: boolean;
  meta: Record<string, unknown> | null;
};

// Cloud Run / Vercel 앞단 프록시 기준. 클라이언트가 위조할 수 있어 참고용이다.
export function getRequestIp(req: Request): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  return req.ip || null;
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  await pool.query(
    `INSERT INTO audit_logs (
       actor_type, actor_id, actor_label, action,
       target_type, target_id, target_label, ip, success, meta
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
    [
      entry.actorType,
      entry.actorId ?? null,
      entry.actorLabel ?? null,
      entry.action,
      entry.targetType ?? null,
      entry.targetId ?? null,
      entry.targetLabel ?? null,
      entry.ip ?? null,
      entry.success ?? true,
      entry.meta ? JSON.stringify(entry.meta) : null,
    ],
  );
}

// 요청을 막지 않는다. 로그 실패가 API 실패가 되면 안 된다.
export function recordAudit(entry: AuditEntry): void {
  void writeAuditLog(entry).catch((error) => {
    console.error("[audit] Failed to write audit log:", error);
  });
}

export async function listAuditLogs(options: {
  limit?: number;
  action?: string;
}): Promise<AuditLogRow[]> {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  const action = options.action?.trim() || null;

  const result = await pool.query<{
    id: string;
    created_at: Date;
    actor_type: string;
    actor_id: number | null;
    actor_label: string | null;
    action: string;
    target_type: string | null;
    target_id: number | null;
    target_label: string | null;
    ip: string | null;
    success: boolean;
    meta: Record<string, unknown> | null;
  }>(
    `SELECT id, created_at, actor_type, actor_id, actor_label, action,
            target_type, target_id, target_label, ip, success, meta
     FROM audit_logs
     WHERE ($1::text IS NULL OR action = $1)
     ORDER BY created_at DESC
     LIMIT $2`,
    [action, limit],
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    createdAt: row.created_at.toISOString(),
    actorType: row.actor_type,
    actorId: row.actor_id,
    actorLabel: row.actor_label,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    targetLabel: row.target_label,
    ip: row.ip,
    success: row.success,
    meta: row.meta,
  }));
}
