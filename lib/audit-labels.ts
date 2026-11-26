/** 비개발자도 읽을 수 있게 감사 로그 액션을 한글로 표기한다 */

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "admin.login": "로그인",
  "admin.logout": "로그아웃",
  "audit.list": "감사 로그 조회",
  "contract.create": "계약서 작성",
  "contract.list": "계약서 목록 조회",
  "contract.view": "계약서 상세 조회",
  "contract.public_view": "고객 링크 열람",
  "contract.update": "계약서 수정",
  "contract.delete": "계약서 삭제",
  "contract.status": "계약 상태 변경",
  "contract.approval_number": "승인번호 저장",
  "contract.admin_memo": "관리자 메모 저장",
  "contract.export_excel": "엑셀 다운로드",
  "contract.view_token_reissue": "고객 링크 재발급",
  "contract.send_alimtalk": "알림톡 발송",
  "contract.send_sms": "문자 발송",
};

export type AuditCategory = {
  id: string;
  label: string;
  actions: string[] | null; // null = 전체
};

export const AUDIT_CATEGORIES: AuditCategory[] = [
  { id: "all", label: "전체", actions: null },
  {
    id: "auth",
    label: "로그인",
    actions: ["admin.login", "admin.logout"],
  },
  {
    id: "view",
    label: "조회",
    actions: [
      "contract.list",
      "contract.view",
      "contract.public_view",
      "contract.view_token_reissue",
      "audit.list",
    ],
  },
  {
    id: "edit",
    label: "작성·수정",
    actions: [
      "contract.create",
      "contract.update",
      "contract.delete",
      "contract.status",
      "contract.approval_number",
      "contract.admin_memo",
    ],
  },
  {
    id: "excel",
    label: "엑셀",
    actions: ["contract.export_excel"],
  },
  {
    id: "send",
    label: "알림톡·문자",
    actions: ["contract.send_alimtalk", "contract.send_sms"],
  },
];

export function getAuditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function getAuditActorTypeLabel(actorType: string): string {
  switch (actorType) {
    case "admin":
      return "관리자";
    case "public":
      return "고객";
    case "anonymous":
      return "비로그인";
    default:
      return actorType;
  }
}
