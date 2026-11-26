/** 감사 로그 조회는 이 관리자만 가능 (개발자용) */
export const AUDIT_LOG_VIEWER_USERNAME = "kimhi1105";

export function canViewAuditLogs(username: string | null | undefined): boolean {
  return username === AUDIT_LOG_VIEWER_USERNAME;
}
