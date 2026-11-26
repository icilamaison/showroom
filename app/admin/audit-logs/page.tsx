"use client";

import { canViewAuditLogs } from "@/lib/audit-access";
import {
  AUDIT_CATEGORIES,
  getAuditActionLabel,
  getAuditActorTypeLabel,
} from "@/lib/audit-labels";
import {
  ApiClientError,
  fetchAdminMe,
  fetchAuditLogs,
  type AuditLogItem,
} from "@/lib/api-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import "../admin.css";

function formatWhen(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const time = date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (sameDay) return `오늘 ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (isYesterday) return `어제 ${time}`;

  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatWho(item: AuditLogItem) {
  const name = item.actorLabel?.trim();
  const role = getAuditActorTypeLabel(item.actorType);
  if (name) return `${name} (${role})`;
  return role;
}

function formatWhatAbout(item: AuditLogItem) {
  if (item.targetLabel?.trim()) return item.targetLabel.trim();
  if (item.targetId != null) return `번호 ${item.targetId}`;
  return "";
}

export default function AdminAuditLogsPage() {
  const router = useRouter();
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [categoryId, setCategoryId] = useState("all");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError("");

      try {
        const me = await fetchAdminMe();
        if (!canViewAuditLogs(me.username)) {
          if (!cancelled) {
            setAllowed(false);
            setError("감사 로그는 개발자 계정만 볼 수 있습니다.");
          }
          return;
        }

        const result = await fetchAuditLogs({ limit: 200 });
        if (!cancelled) {
          setAllowed(true);
          setItems(result.items);
        }
      } catch (loadError) {
        if (cancelled) return;
        if (loadError instanceof ApiClientError && loadError.status === 401) {
          router.push("/admin/login?redirect=/admin/audit-logs");
          return;
        }
        if (loadError instanceof ApiClientError && loadError.status === 403) {
          setAllowed(false);
          setError("감사 로그는 개발자 계정만 볼 수 있습니다.");
          return;
        }
        setError(
          loadError instanceof ApiClientError
            ? loadError.message
            : "감사 로그를 불러오지 못했습니다.",
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const category = AUDIT_CATEGORIES.find((item) => item.id === categoryId) ?? AUDIT_CATEGORIES[0];

  const visibleItems = useMemo(() => {
    if (!category.actions) return items;
    const allowedActions = new Set(category.actions);
    return items.filter((item) => allowedActions.has(item.action));
  }, [items, category]);

  return (
    <main className="app-page">
      <div className="app-container app-container--wide">
        <Link href="/" className="app-back-link">
          ← 홈
        </Link>

        <header className="app-header app-header--page admin-page-header">
          <img
            className="app-brand"
            src="https://icilamaison.com/26renewer/resource/image/logo_black.svg"
            alt="이씨라메종"
          />
          <div className="admin-list-toolbar">
            <h1 className="app-title app-title--page">
              활동 기록
              <span>
                {allowed
                  ? `최근 ${visibleItems.length.toLocaleString("ko-KR")}건`
                  : ""}
              </span>
            </h1>
          </div>
          <p className="app-description">
            누가 언제 무엇을 했는지 한눈에 확인합니다. (주 1회 점검용)
          </p>
        </header>

        {error ? <p className="app-alert app-alert--error">{error}</p> : null}

        {allowed ? (
          <>
            <div className="admin-status-tabs" role="tablist" aria-label="기록 종류">
              {AUDIT_CATEGORIES.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={categoryId === tab.id}
                  className={`admin-status-tab${categoryId === tab.id ? " is-active" : ""}`}
                  onClick={() => setCategoryId(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {isLoading ? (
              <p className="app-empty">불러오는 중…</p>
            ) : visibleItems.length === 0 ? (
              <p className="app-empty">해당 기록이 없습니다.</p>
            ) : (
              <ul className="admin-audit-feed">
                {visibleItems.map((item) => {
                  const about = formatWhatAbout(item);
                  return (
                    <li
                      key={item.id}
                      className={`admin-audit-feed__item${item.success ? "" : " is-failed"}`}
                    >
                      <div className="admin-audit-feed__main">
                        <div className="admin-audit-feed__title-row">
                          <strong className="admin-audit-feed__action">
                            {getAuditActionLabel(item.action)}
                          </strong>
                          <span
                            className={`admin-audit-feed__result${item.success ? " is-ok" : " is-bad"}`}
                          >
                            {item.success ? "성공" : "실패"}
                          </span>
                        </div>
                        <p className="admin-audit-feed__meta">
                          <span>{formatWho(item)}</span>
                          {about ? <span> · {about}</span> : null}
                          {item.ip ? (
                            <span className="admin-audit-feed__ip"> · {item.ip}</span>
                          ) : null}
                        </p>
                      </div>
                      <time
                        className="admin-audit-feed__when"
                        dateTime={item.createdAt}
                        title={new Date(item.createdAt).toLocaleString("ko-KR")}
                      >
                        {formatWhen(item.createdAt)}
                      </time>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
