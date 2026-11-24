"use client";

import {
  ApiClientError,
  deleteAdminContract,
  downloadAdminBulkOrderExcel,
  fetchAdminContracts,
  updateAdminContractMemo,
  type ContractListItem,
  type ContractListResult,
} from "@/lib/api-client";
import {
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
  getContractStatusLabel,
  type ContractStatus,
} from "@/lib/constants/contract-status";
import { keepPreviousData, useIsRestoring, useQuery, useQueryClient } from "@tanstack/react-query";
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

const ADMIN_MEMO_MAX_LENGTH = 500;

function formatAmount(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ko-KR");
}

function AdminMemoField({
  contractId,
  value,
  onSaved,
  onError,
}: {
  contractId: number;
  value: string;
  onSaved: (memo: string) => void;
  onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  async function saveIfChanged() {
    const next = draft.trim();
    if (next === value.trim() || isSaving) {
      setDraft(value);
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateAdminContractMemo(contractId, next);
      onSaved(updated.adminMemo);
      setDraft(updated.adminMemo);
    } catch (error) {
      setDraft(value);
      if (error instanceof ApiClientError && error.status === 401) {
        onError("UNAUTHORIZED");
        return;
      }
      onError(
        error instanceof ApiClientError
          ? error.message
          : "메모 저장에 실패했습니다.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <input
      type="text"
      className="admin-memo-input"
      value={draft}
      maxLength={ADMIN_MEMO_MAX_LENGTH}
      placeholder="메모"
      disabled={isSaving}
      onChange={(event) => setDraft(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          (event.target as HTMLInputElement).blur();
        }
      }}
      onBlur={() => {
        void saveIfChanged();
      }}
      aria-label="관리자 메모"
    />
  );
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
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();

  // 한 번 본 탭·페이지는 캐시로 바로 보여주고 뒤에서 갱신한다. 새 조건은 응답 전까지 이전 목록을 유지한다.
  const listQuery = useQuery({
    queryKey: ["adminContracts", appliedFilters, page],
    queryFn: () =>
      fetchAdminContracts({ ...toApiFilters(appliedFilters), page, limit: 20 }),
    placeholderData: keepPreviousData,
  });
  const data = listQuery.data ?? null;
  const isLoading = listQuery.isPending;
  // 저장된 캐시를 복원하는 동안(서버 렌더 포함)은 "불러오는 중"이 깜빡이지 않도록 비워 둔다
  const isRestoring = useIsRestoring();
  const isUnauthorized =
    listQuery.error instanceof ApiClientError && listQuery.error.status === 401;
  const listError =
    listQuery.isError && !isUnauthorized ? "계약서 목록을 불러오지 못했습니다." : "";

  useEffect(() => {
    if (isUnauthorized) router.push("/admin/login");
  }, [isUnauthorized, router]);

  // 검색·상태 탭이 바뀌면 이전 선택을 비운다
  useEffect(() => {
    setSelectedIds(new Set());
  }, [appliedFilters]);

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

  const pageIds = useMemo(
    () => data?.items.map((item) => item.id) ?? [],
    [data],
  );
  const selectedCount = selectedIds.size;
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected =
    pageIds.some((id) => selectedIds.has(id)) && !allPageSelected;

  function toggleSelect(id: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectPage() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allPageSelected) {
        for (const id of pageIds) next.delete(id);
      } else {
        for (const id of pageIds) next.add(id);
      }
      return next;
    });
  }

  const filteredCount = data?.total ?? 0;
  const statusTabLabel = appliedFilters.status
    ? getContractStatusLabel(appliedFilters.status)
    : "전체";
  const downloadLabel =
    selectedCount > 0
      ? `선택 엑셀 (${selectedCount})`
      : `엑셀 다운로드 (${filteredCount})`;

  /** 체크한 건이 있으면 선택분, 없으면 현재 탭·검색 조건 전부 */
  async function handleBulkDownload() {
    if (selectedCount === 0 && filteredCount === 0) {
      setError("다운로드할 계약서가 없습니다.");
      return;
    }

    setIsDownloading(true);
    setError("");

    try {
      await downloadAdminBulkOrderExcel(
        selectedCount > 0
          ? { ids: [...selectedIds] }
          : toApiFilters(appliedFilters),
      );
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

  function handleMemoSaved(id: number, adminMemo: string) {
    queryClient.setQueriesData<ContractListResult>(
      { queryKey: ["adminContracts"] },
      (current) => {
        if (!current) return current;
        return {
          ...current,
          items: current.items.map((item) =>
            item.id === id ? { ...item, adminMemo } : item,
          ),
        };
      },
    );
  }

  function handleMemoError(message: string) {
    if (message === "UNAUTHORIZED") {
      router.push("/admin/login");
      return;
    }
    setError(message);
  }

  // 상세 화면 삭제와 같은 확인 문구·API. 행을 누르면 상세로 가므로 버튼 클릭은 행까지 전달하지 않는다
  async function handleDelete(event: React.MouseEvent, item: ContractListItem) {
    event.stopPropagation();
    if (!window.confirm(`계약서 ${item.contractNumber}를 삭제할까요?\n삭제하면 되돌릴 수 없고, 고객용 링크도 더 이상 열리지 않습니다.`)) {
      return;
    }

    setDeletingId(item.id);
    setError("");

    try {
      await deleteAdminContract(item.id);
      queryClient.removeQueries({ queryKey: ["adminContract", item.id] });
      await queryClient.invalidateQueries({ queryKey: ["adminContracts"] });
    } catch (deleteError) {
      if (deleteError instanceof ApiClientError && deleteError.status === 401) {
        router.push("/admin/login");
        return;
      }
      setError(
        deleteError instanceof ApiClientError ? deleteError.message : "계약서 삭제 중 오류가 발생했습니다.",
      );
    } finally {
      setDeletingId(null);
    }
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
                disabled={
                  isDownloading ||
                  (selectedCount === 0 && filteredCount === 0)
                }
                title={
                  selectedCount > 0
                    ? "체크한 계약서만 다운로드"
                    : `${statusTabLabel} 목록 전체 다운로드`
                }
                onClick={() => {
                  void handleBulkDownload();
                }}
              >
                {isDownloading ? "다운로드 중..." : downloadLabel}
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
          {isRestoring ? null : isLoading ? (
            <p className="app-empty">목록을 불러오는 중...</p>
          ) : !data || data.items.length === 0 ? (
            <p className="app-empty">조회된 계약서가 없습니다.</p>
          ) : (
            <>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th className="admin-table__check">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        ref={(element) => {
                          if (element) element.indeterminate = somePageSelected;
                        }}
                        onChange={toggleSelectPage}
                        aria-label="현재 페이지 전체 선택"
                      />
                    </th>
                    <th>계약번호</th>
                    <th>고객</th>
                    <th>상품명</th>
                    <th>계약금액</th>
                    <th>상태</th>
                    <th>작성일</th>
                    <th>메모</th>
                    <th aria-hidden="true" />
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
                      <td className="admin-table__check">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                          aria-label={`${item.contractNumber} 선택`}
                        />
                      </td>
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
                      <td className="admin-table__memo">
                        <AdminMemoField
                          contractId={item.id}
                          value={item.adminMemo ?? ""}
                          onSaved={(memo) => handleMemoSaved(item.id, memo)}
                          onError={handleMemoError}
                        />
                      </td>
                      <td className="admin-table__delete">
                        <button
                          type="button"
                          className="app-button app-button--danger"
                          disabled={deletingId === item.id}
                          onClick={(event) => void handleDelete(event, item)}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          {deletingId === item.id ? "삭제 중..." : "삭제"}
                        </button>
                      </td>
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
                      <div className="admin-mobile-item__leading">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                          aria-label={`${item.contractNumber} 선택`}
                        />
                        <div>
                          <div className="admin-mobile-item__name">
                            {item.customerName}
                          </div>
                          <div className="admin-mobile-item__phone">
                            {item.customerPhone}
                          </div>
                        </div>
                      </div>
                      <span className={`admin-status admin-status--${item.status}`}>
                        {getContractStatusLabel(item.status)}
                      </span>
                    </div>
                    <div className="admin-mobile-item__product">
                      {item.productName}
                    </div>
                    <div className="admin-mobile-item__memo">
                      <AdminMemoField
                        contractId={item.id}
                        value={item.adminMemo ?? ""}
                        onSaved={(memo) => handleMemoSaved(item.id, memo)}
                        onError={handleMemoError}
                      />
                    </div>
                    <div className="admin-mobile-item__meta">
                      <span>
                        {item.contractNumber} · {formatDate(item.createdAt)}
                      </span>
                      <span className="admin-mobile-item__amount">
                        {formatAmount(item.contractAmount)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="app-button app-button--danger admin-mobile-item__delete"
                      disabled={deletingId === item.id}
                      onClick={(event) => void handleDelete(event, item)}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      {deletingId === item.id ? "삭제 중..." : "삭제"}
                    </button>
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
