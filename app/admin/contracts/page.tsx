"use client";

import {
  ApiClientError,
  downloadAdminBulkOrderExcel,
  fetchAdminContracts,
  type ContractListItem,
} from "@/lib/api-client";
import {
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
  getContractStatusLabel,
  type ContractStatus,
} from "@/lib/constants/contract-status";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import "../admin.css";

type FilterState = {
  keyword: string;
  status: string;
  dateFrom: string;
  dateTo: string;
};

const initialFilters: FilterState = {
  keyword: "",
  status: "",
  dateFrom: "",
  dateTo: "",
};

function formatAmount(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ko-KR");
}

/** 검색어가 숫자 위주면 연락처, 아니면 고객명으로 보낸다 */
function keywordToNamePhone(keyword: string) {
  const trimmed = keyword.trim();
  if (!trimmed) {
    return { customerName: "", customerPhone: "" };
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 3 && digits.length >= trimmed.replace(/[\s-]/g, "").length * 0.6) {
    return { customerName: "", customerPhone: digits };
  }

  return { customerName: trimmed, customerPhone: "" };
}

function toApiFilters(filters: FilterState) {
  const { customerName, customerPhone } = keywordToNamePhone(filters.keyword);
  return {
    customerName,
    customerPhone,
    status: filters.status,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  };
}

export default function AdminContractsPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(initialFilters);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

  // 한 번 본 탭·페이지는 캐시로 바로 보여주고 뒤에서 갱신한다. 새 조건은 응답 전까지 이전 목록을 유지한다.
  const listQuery = useQuery({
    queryKey: ["adminContracts", appliedFilters, page],
    queryFn: () =>
      fetchAdminContracts({ ...toApiFilters(appliedFilters), page, limit: 20 }),
    placeholderData: keepPreviousData,
  });
  const data = listQuery.data ?? null;
  const isLoading = listQuery.isPending;
  const isUnauthorized =
    listQuery.error instanceof ApiClientError && listQuery.error.status === 401;
  const listError =
    listQuery.isError && !isUnauthorized ? "계약서 목록을 불러오지 못했습니다." : "";

  useEffect(() => {
    if (isUnauthorized) router.push("/admin/login");
  }, [isUnauthorized, router]);

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
  }

  function handleReset() {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setPage(1);
  }

  function handleStatusTab(status: string) {
    const next = { ...filters, status };
    setFilters(next);
    setAppliedFilters(next);
    setPage(1);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  const statusCounts = data?.statusCounts ?? {};
  const allCount = useMemo(
    () => Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
    [statusCounts],
  );

  async function handleBulkDownload() {
    setIsDownloading(true);
    setError("");

    try {
      await downloadAdminBulkOrderExcel(toApiFilters(appliedFilters));
    } catch (downloadError) {
      if (downloadError instanceof ApiClientError && downloadError.status === 401) {
        router.push("/admin/login");
        return;
      }

      setError(
        downloadError instanceof ApiClientError
          ? downloadError.message
          : "엑셀 다운로드에 실패했습니다.",
      );
    } finally {
      setIsDownloading(false);
    }
  }

  function openDetail(id: number) {
    router.push(`/admin/contracts/${id}`);
  }

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
              계약서 목록
              <span>
                {data ? `총 ${allCount.toLocaleString("ko-KR")}건` : ""}
              </span>
            </h1>
            <div className="admin-list-toolbar__actions">
              <button
                type="button"
                className="app-button app-button--secondary admin-btn-compact"
                disabled={isDownloading}
                onClick={() => {
                  void handleBulkDownload();
                }}
              >
                {isDownloading ? "다운로드 중..." : "엑셀 전체 다운로드"}
              </button>
              <Link href="/contract/write" className="app-button admin-btn-compact">
                + 새 계약서
              </Link>
            </div>
          </div>
        </header>

        <div className="admin-status-tabs" role="tablist" aria-label="상태 필터">
          <button
            type="button"
            className={`admin-status-tab${appliedFilters.status === "" ? " is-active" : ""}`}
            onClick={() => handleStatusTab("")}
          >
            전체 <em>{allCount}</em>
          </button>
          {CONTRACT_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              className={`admin-status-tab${appliedFilters.status === status ? " is-active" : ""}`}
              onClick={() => handleStatusTab(status)}
            >
              {CONTRACT_STATUS_LABELS[status as ContractStatus]}{" "}
              <em>{statusCounts[status] ?? 0}</em>
            </button>
          ))}
        </div>

        <form className="admin-searchbar" onSubmit={handleSearch}>
          <div className="app-field">
            <label htmlFor="keyword" className="admin-sr-only">
              검색
            </label>
            <input
              id="keyword"
              type="text"
              value={filters.keyword}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  keyword: event.target.value,
                }))
              }
              className="app-input admin-input-compact"
              placeholder="고객명 또는 연락처로 검색"
            />
          </div>

          <div className="app-field">
            <label htmlFor="dateFrom" className="admin-sr-only">
              시작일
            </label>
            <input
              id="dateFrom"
              type="date"
              value={filters.dateFrom}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  dateFrom: event.target.value,
                }))
              }
              className="app-input admin-input-compact"
            />
          </div>

          <div className="app-field">
            <label htmlFor="dateTo" className="admin-sr-only">
              종료일
            </label>
            <input
              id="dateTo"
              type="date"
              value={filters.dateTo}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  dateTo: event.target.value,
                }))
              }
              className="app-input admin-input-compact"
            />
          </div>

          <button type="submit" className="app-button admin-btn-compact">
            검색
          </button>
          <button
            type="button"
            className="app-button app-button--secondary admin-btn-compact"
            onClick={handleReset}
          >
            초기화
          </button>
        </form>

        {error || listError ? (
          <p className="app-alert app-alert--error">{error || listError}</p>
        ) : null}

        <div className="admin-table-wrap">
          {isLoading ? (
            <p className="app-empty">목록을 불러오는 중...</p>
          ) : !data || data.items.length === 0 ? (
            <p className="app-empty">조회된 계약서가 없습니다.</p>
          ) : (
            <>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>계약번호</th>
                    <th>고객</th>
                    <th>상품명</th>
                    <th>계약금액</th>
                    <th>상태</th>
                    <th>작성일</th>
                    <th aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item: ContractListItem) => (
                    <tr
                      key={item.id}
                      onClick={() => openDetail(item.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openDetail(item.id);
                        }
                      }}
                      tabIndex={0}
                      role="link"
                    >
                      <td>{item.contractNumber}</td>
                      <td>
                        <div className="admin-table__customer-name">
                          {item.customerName}
                        </div>
                        <div className="admin-table__customer-phone">
                          {item.customerPhone}
                        </div>
                      </td>
                      <td>{item.productName}</td>
                      <td>{formatAmount(item.contractAmount)}</td>
                      <td>
                        <span className={`admin-status admin-status--${item.status}`}>
                          {getContractStatusLabel(item.status)}
                        </span>
                      </td>
                      <td>{formatDate(item.createdAt)}</td>
                      <td className="admin-table__chevron">›</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="admin-mobile-list">
                {data.items.map((item) => (
                  <div
                    key={item.id}
                    className="admin-mobile-item"
                    onClick={() => openDetail(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openDetail(item.id);
                      }
                    }}
                    tabIndex={0}
                    role="link"
                  >
                    <div className="admin-mobile-item__top">
                      <div>
                        <div className="admin-mobile-item__name">
                          {item.customerName}
                        </div>
                        <div className="admin-mobile-item__phone">
                          {item.customerPhone}
                        </div>
                      </div>
                      <span className={`admin-status admin-status--${item.status}`}>
                        {getContractStatusLabel(item.status)}
                      </span>
                    </div>
                    <div className="admin-mobile-item__product">
                      {item.productName}
                    </div>
                    <div className="admin-mobile-item__meta">
                      <span>
                        {item.contractNumber} · {formatDate(item.createdAt)}
                      </span>
                      <span className="admin-mobile-item__amount">
                        {formatAmount(item.contractAmount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {data ? (
          <div className="admin-pagination">
            <p className="admin-pagination__info">
              총 {data.total}건 · {data.page}/{totalPages} 페이지
            </p>
            <div className="admin-filters__actions">
              <button
                type="button"
                className="app-button app-button--secondary"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                이전
              </button>
              <button
                type="button"
                className="app-button app-button--secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                다음
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
