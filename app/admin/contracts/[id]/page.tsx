"use client";

import {
  ApiClientError,
  fetchAdminContractById,
  getAdminOrderExcelDownloadUrl,
  updateAdminContractStatus,
  type ContractDetail,
} from "@/lib/api-client";
import {
  CONTRACT_STATUSES,
  getContractStatusLabel,
} from "@/lib/constants/contract-status";
import type { PurchaseContractPayload } from "@/lib/validation/contract";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import "../../admin.css";

function formatAmount(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ko-KR");
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="admin-detail-item">
      <span className="admin-detail-item__label">{label}</span>
      <span className="admin-detail-item__value">{value}</span>
    </div>
  );
}

function isPurchaseContractPayload(
  payload: unknown,
): payload is PurchaseContractPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "buyerName" in payload &&
    "products" in payload
  );
}

function formatPaymentMethod(method: string) {
  if (method === "card") {
    return "카드";
  }

  if (method === "bank_transfer") {
    return "계좌이체";
  }

  return method;
}

function formatCashReceiptType(type: string) {
  if (type === "income_deduction") {
    return "소득공제용";
  }

  if (type === "expense_proof") {
    return "지출증빙용";
  }

  return "-";
}

function PurchaseContractDetails({ payload }: { payload: PurchaseContractPayload }) {
  const filledProducts = payload.products.filter((product) => product.name.trim());

  return (
    <>
      <section className="admin-detail-card">
        <h2 className="admin-detail-card__title">구매 계약서 정보</h2>
        <DetailItem label="담당자" value={payload.managerName || "-"} />
        <DetailItem label="작성일자" value={payload.writtenDate} />
        <DetailItem label="동의 일자" value={payload.agreementDate} />
      </section>

      <section className="admin-detail-card">
        <h2 className="admin-detail-card__title">구매자 / 수령자</h2>
        <DetailItem label="구매자 성명" value={payload.buyerName} />
        <DetailItem label="구매자 연락처" value={payload.buyerPhone} />
        <DetailItem
          label="수령자"
          value={payload.recipientSameAsBuyer ? "구매자와 동일" : "별도 입력"}
        />
        {!payload.recipientSameAsBuyer ? (
          <>
            <DetailItem label="수령자 성명" value={payload.recipientName || "-"} />
            <DetailItem
              label="수령자 연락처"
              value={payload.recipientPhone || "-"}
            />
            <DetailItem
              label="배송지 주소"
              value={payload.recipientAddress || "-"}
            />
          </>
        ) : null}
      </section>

      <section className="admin-detail-card">
        <h2 className="admin-detail-card__title">상품 정보</h2>
        {filledProducts.length === 0 ? (
          <DetailItem label="상품" value="-" />
        ) : (
          filledProducts.map((product, index) => (
            <DetailItem
              key={`${product.name}-${index}`}
              label={`상품 ${index + 1}`}
              value={`${product.name} / ${product.color || "-"} / ${product.size || "-"} / 수량 ${product.quantity}${product.remarks ? ` / ${product.remarks}` : ""}`}
            />
          ))
        )}
      </section>

      <section className="admin-detail-card">
        <h2 className="admin-detail-card__title">결제 정보</h2>
        <DetailItem
          label="결제수단"
          value={formatPaymentMethod(payload.paymentMethod)}
        />
        {payload.paymentMethod === "bank_transfer" ? (
          <>
            <DetailItem
              label="현금영수증"
              value={formatCashReceiptType(payload.cashReceiptType || "")}
            />
            {payload.cashReceiptType === "income_deduction" ? (
              <DetailItem
                label="현금영수증 휴대폰"
                value={payload.cashReceiptPhone || "-"}
              />
            ) : null}
            {payload.cashReceiptType === "expense_proof" ? (
              <DetailItem
                label="사업자등록번호"
                value={payload.cashReceiptBusinessNumber || "-"}
              />
            ) : null}
            <DetailItem
              label="세금계산서 발행"
              value={payload.taxInvoiceRequested ? "요청" : "미요청"}
            />
            {payload.taxInvoiceRequested ? (
              <DetailItem
                label="세금계산서 이메일"
                value={payload.taxInvoiceEmail || "-"}
              />
            ) : null}
          </>
        ) : null}
      </section>
    </>
  );
}

export default function AdminContractDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const contractId = Number(params.id);
  const isValidId = Number.isInteger(contractId) && contractId > 0;

  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isValidId) {
      setIsLoading(false);
      setError("유효하지 않은 계약서 ID입니다.");
      return;
    }

    async function loadContract() {
      setIsLoading(true);
      setError("");

      try {
        const result = await fetchAdminContractById(contractId);
        setContract(result);
        setSelectedStatus(result.status);
      } catch (loadError) {
        if (loadError instanceof ApiClientError) {
          if (loadError.status === 401) {
            router.push("/admin/login");
            return;
          }

          if (loadError.status === 404) {
            setError("계약서를 찾을 수 없습니다.");
            return;
          }
        }

        setError("계약서 상세 정보를 불러오지 못했습니다.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadContract();
  }, [contractId, isValidId, router]);

  async function handleStatusSave() {
    if (!isValidId || !contract) {
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const updated = await updateAdminContractStatus(contractId, selectedStatus);
      setContract((current) =>
        current
          ? {
              ...current,
              status: updated.status,
              updatedAt: updated.updatedAt,
            }
          : current,
      );
      setSuccessMessage("상태가 저장되었습니다.");
    } catch (saveError) {
      if (saveError instanceof ApiClientError) {
        if (saveError.status === 401) {
          router.push("/admin/login");
          return;
        }

        setError(saveError.message);
      } else {
        setError("상태 저장 중 오류가 발생했습니다.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  const purchasePayload = isPurchaseContractPayload(contract?.payload)
    ? contract.payload
    : null;

  return (
    <main className="admin-page admin-page--wide">
      <div className="admin-container">
        <Link href="/admin/contracts" className="admin-back-link">
          ← 목록으로
        </Link>

        <header className="admin-header">
          <h1 className="admin-header__title">계약서 상세</h1>
          <p className="admin-header__description">
            고객이 제출한 계약 정보를 확인하고 상태를 변경할 수 있습니다.
          </p>
        </header>

        {error ? <p className="admin-error">{error}</p> : null}
        {successMessage ? (
          <p className="admin-success">{successMessage}</p>
        ) : null}

        {isLoading ? (
          <p className="admin-empty">상세 정보를 불러오는 중...</p>
        ) : contract ? (
          <>
            <div className="admin-detail-grid">
              <section className="admin-detail-card">
                <h2 className="admin-detail-card__title">계약 정보</h2>
                <DetailItem label="계약번호" value={contract.contractNumber} />
                <DetailItem
                  label="상태"
                  value={getContractStatusLabel(contract.status)}
                />
                <DetailItem
                  label="작성일"
                  value={formatDateTime(contract.createdAt)}
                />
                <DetailItem
                  label="최종 수정일"
                  value={formatDateTime(contract.updatedAt)}
                />
              </section>

              {purchasePayload ? (
                <PurchaseContractDetails payload={purchasePayload} />
              ) : (
                <>
                  <section className="admin-detail-card">
                    <h2 className="admin-detail-card__title">고객 정보</h2>
                    <DetailItem label="고객명" value={contract.customerName} />
                    <DetailItem label="연락처" value={contract.customerPhone} />
                    <DetailItem label="주소" value={contract.customerAddress} />
                    <DetailItem label="서명명" value={contract.signatureName} />
                  </section>

                  <section className="admin-detail-card">
                    <h2 className="admin-detail-card__title">계약 내용</h2>
                    <DetailItem
                      label="상품명/서비스명"
                      value={contract.productName}
                    />
                    <DetailItem
                      label="계약 금액"
                      value={formatAmount(contract.contractAmount)}
                    />
                    <DetailItem
                      label="계약 시작일"
                      value={contract.contractStartDate}
                    />
                    <DetailItem
                      label="계약 종료일"
                      value={contract.contractEndDate}
                    />
                    <DetailItem
                      label="특약사항"
                      value={contract.specialTerms || "-"}
                    />
                    <DetailItem
                      label="약관 동의"
                      value={contract.termsAgreed ? "동의함" : "미동의"}
                    />
                  </section>
                </>
              )}

              {purchasePayload ? (
                <section className="admin-detail-card">
                  <h2 className="admin-detail-card__title">서명 / 동의</h2>
                  <DetailItem label="서명명" value={contract.signatureName} />
                  <DetailItem
                    label="약관 동의"
                    value={contract.termsAgreed ? "동의함" : "미동의"}
                  />
                  <DetailItem
                    label="요약"
                    value={contract.specialTerms || "-"}
                  />
                </section>
              ) : null}
            </div>

            {purchasePayload ? (
              <section className="admin-detail-card">
                <h2 className="admin-detail-card__title">PlayAuto 주문 엑셀</h2>
                <p className="admin-header__description">
                  고객이 입력한 정보를 PlayAuto 신규주문 업로드 양식으로
                  내려받을 수 있습니다.
                </p>
                <div className="admin-detail-actions">
                  <a
                    href={getAdminOrderExcelDownloadUrl(contract.id)}
                    className="admin-button"
                    download
                  >
                    주문 엑셀 다운로드
                  </a>
                </div>
              </section>
            ) : null}

            <section className="admin-detail-card">
              <h2 className="admin-detail-card__title">상태 변경</h2>
              <div className="admin-detail-actions">
                <div className="admin-form__field" style={{ minWidth: "220px" }}>
                  <label htmlFor="status" className="admin-form__label">
                    상태
                  </label>
                  <select
                    id="status"
                    value={selectedStatus}
                    onChange={(event) => setSelectedStatus(event.target.value)}
                    className="admin-form__input"
                  >
                    {CONTRACT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {getContractStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="admin-button"
                  disabled={isSaving || selectedStatus === contract.status}
                  onClick={() => void handleStatusSave()}
                >
                  {isSaving ? "저장 중..." : "저장"}
                </button>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
