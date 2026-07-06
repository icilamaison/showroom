"use client";

import {
  ApiClientError,
  fetchAdminContracts,
  type ContractListItem,
  type ContractListResult,
} from "@/lib/api-client";
import {
  CONTRACT_STATUS_OPTIONS,
  getContractStatusLabel,
} from "@/lib/constants/contract-status";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import "../admin.css";

type FilterState = {
  customerName: string;
  customerPhone: string;
  status: string;
};

const initialFilters: FilterState = {
  customerName: "",
  customerPhone: "",
  status: "",
};

function formatAmount(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ko-KR");
}

export default function AdminContractsPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(initialFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ContractListResult | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadContracts() {
      setIsLoading(true);
      setError("");

      try {
        const result = await fetchAdminContracts({
          customerName: appliedFilters.customerName,
          customerPhone: appliedFilters.customerPhone,
          status: appliedFilters.status,
          page,
          limit: 20,
        });
        setData(result);
      } catch (loadError) {
        if (loadError instanceof ApiClientError && loadError.status === 401) {
          router.push("/admin/login");
          return;
        }

        setError("계약서 목록을 불러오지 못했습니다.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadContracts();
  }, [appliedFilters, page, router]);

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

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <main className="admin-page admin-page--wide">
      <div className="admin-container">
        <header className="admin-header">
          <h1 className="admin-header__title">계약서 목록</h1>
          <p className="admin-header__description">
            접수된 계약서를 조회하고 상세 내용을 확인할 수 있습니다.
          </p>
        </header>

        <form className="admin-filters" onSubmit={handleSearch}>
          <div className="admin-form__field">
            <label htmlFor="customerName" className="admin-form__label">
              고객명
            </label>
            <input
              id="customerName"
              type="text"
              value={filters.customerName}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  customerName: event.target.value,
                }))
              }
              className="admin-form__input"
              placeholder="고객명 검색"
            />
          </div>

          <div className="admin-form__field">
            <label htmlFor="customerPhone" className="admin-form__label">
              연락처
            </label>
            <input
              id="customerPhone"
              type="text"
              value={filters.customerPhone}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  customerPhone: event.target.value,
                }))
              }
              className="admin-form__input"
              placeholder="연락처 검색"
            />
          </div>

          <div className="admin-form__field">
            <label htmlFor="status" className="admin-form__label">
              상태
            </label>
            <select
              id="status"
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
              className="admin-form__input"
            >
              {CONTRACT_STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-filters__actions">
            <button type="submit" className="admin-button">
              검색
            </button>
            <button
              type="button"
              className="admin-button admin-button--secondary"
              onClick={handleReset}
            >
              초기화
            </button>
          </div>
        </form>

        {error ? <p className="admin-error">{error}</p> : null}

        <div className="admin-table-wrap">
          {isLoading ? (
            <p className="admin-empty">목록을 불러오는 중...</p>
          ) : !data || data.items.length === 0 ? (
            <p className="admin-empty">조회된 계약서가 없습니다.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>계약번호</th>
                  <th>고객명</th>
                  <th>연락처</th>
                  <th>상품명</th>
                  <th>계약금액</th>
                  <th>상태</th>
                  <th>작성일</th>
                  <th>상세보기</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item: ContractListItem) => (
                  <tr key={item.id}>
                    <td>{item.contractNumber}</td>
                    <td>{item.customerName}</td>
                    <td>{item.customerPhone}</td>
                    <td>{item.productName}</td>
                    <td>{formatAmount(item.contractAmount)}</td>
                    <td>
                      <span className="admin-status">
                        {getContractStatusLabel(item.status)}
                      </span>
                    </td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <Link
                        href={`/admin/contracts/${item.id}`}
                        className="admin-link"
                      >
                        상세보기
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                className="admin-button admin-button--secondary"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                이전
              </button>
              <button
                type="button"
                className="admin-button admin-button--secondary"
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
