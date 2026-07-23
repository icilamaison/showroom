"use client";

import {
  ApiClientError,
  downloadAdminOrderExcel,
  fetchAdminContractById,
  updateAdminContractStatus,
  type ContractDetail,
} from "@/lib/api-client";
import {
  CONTRACT_STATUSES,
  getContractStatusLabel,
} from "@/lib/constants/contract-status";
import { formatFullAddress } from "@/lib/address";
import type { PurchaseContractPayload } from "@/lib/validation/contract";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ContractDocumentView from "@/app/contract/ContractDocumentView";
import {
  buildContractPdfFilename,
  purchasePayloadToFormValues,
} from "@/lib/contract-document";
import { exportContractDocumentToPdf } from "@/lib/contract-pdf-export";
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
  stacked = false,
}: {
  label: string;
  value: React.ReactNode;
  stacked?: boolean;
}) {
  return (
    <div
      className={`admin-detail-item${stacked ? " admin-detail-item--stacked" : ""}`}
    >
      <span className="admin-detail-item__label">{label}</span>
      <span className="admin-detail-item__value">{value}</span>
    </div>
  );
}

function ProductTable({
  products,
}: {
  products: PurchaseContractPayload["products"];
}) {
  const filledProducts = products.filter((product) => product.name.trim());

  if (filledProducts.length === 0) {
    return <DetailItem label="상품" value="-" stacked />;
  }

  return (
    <div className="admin-detail-item admin-detail-item--stacked">
      <span className="admin-detail-item__label">상품 목록</span>
      <div className="admin-product-table-wrap">
        <table className="admin-product-table">
          <thead>
            <tr>
              <th>제품명</th>
              <th>컬러</th>
              <th>사이즈</th>
              <th>수량</th>
              <th>금액</th>
            </tr>
          </thead>
          <tbody>
            {filledProducts.map((product, index) => (
              <tr key={`${product.name}-${index}`}>
                <td>{product.name}</td>
                <td>{product.color || "-"}</td>
                <td>{product.size || "-"}</td>
                <td>{product.quantity}</td>
                <td>
                  {product.unitPrice
                    ? `${Number(product.unitPrice).toLocaleString("ko-KR")}원`
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  return (
    <>
      <section className="admin-detail-card">
        <h2 className="app-section-title">구매 계약서 정보</h2>
        <div className="admin-detail-card__body">
          <DetailItem label="담당자" value={payload.managerName || "-"} />
          <DetailItem label="작성일자" value={payload.writtenDate} />
          <DetailItem label="동의 일자" value={payload.agreementDate} />
        </div>
      </section>

      <section className="admin-detail-card">
        <h2 className="app-section-title">구매자 / 수령자</h2>
        <div className="admin-detail-card__body">
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
            </>
          ) : null}
          <DetailItem
            label="우편번호"
            value={payload.recipientPostalCode || "-"}
          />
          <DetailItem
            label="기본주소"
            value={payload.recipientAddress || "-"}
          />
          <DetailItem
            label="상세주소"
            value={payload.recipientAddressDetail || "-"}
          />
          <DetailItem
            label="배송지 전체"
            value={
              formatFullAddress(
                payload.recipientAddress || "",
                payload.recipientAddressDetail || "",
              ) || "-"
            }
          />
        </div>
      </section>

      <section className="admin-detail-card admin-detail-card--full">
        <h2 className="app-section-title">상품 정보</h2>
        <div className="admin-detail-card__body">
          <ProductTable products={payload.products} />
        </div>
      </section>

      <section className="admin-detail-card">
        <h2 className="app-section-title">결제 정보</h2>
        <div className="admin-detail-card__body">
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
        </div>
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const pdfCaptureRef = useRef<HTMLDivElement>(null);

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

    try {
      await updateAdminContractStatus(contractId, selectedStatus);
      router.push("/admin/contracts");
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
  const documentValues = purchasePayload
    ? purchasePayloadToFormValues(purchasePayload)
    : null;

  return (
    <main className="app-page">
      <div className="app-container app-container--wide">
        <Link href="/admin/contracts" className="app-back-link">
          ← 목록으로
        </Link>

        <header className="app-header app-header--page">
          <img
            className="app-brand"
            src="https://icilamaison.com/26renewer/resource/image/logo_black.svg"
            alt="이씨라메종"
          />
          <h1 className="app-title app-title--page">계약서 상세</h1>
          <p className="app-description">
            고객이 제출한 계약 정보를 확인하고 상태를 변경할 수 있습니다.
          </p>
        </header>

        {error ? <p className="app-alert app-alert--error">{error}</p> : null}

        {isLoading ? (
          <p className="app-empty">상세 정보를 불러오는 중...</p>
        ) : contract ? (
          <>
            <section className="admin-detail-hero">
              <div className="admin-detail-hero__main">
                <p className="admin-detail-hero__eyebrow">계약번호</p>
                <h2 className="admin-detail-hero__title">
                  {contract.contractNumber}
                </h2>
                <p className="admin-detail-hero__meta">
                  {contract.customerName} · {contract.customerPhone}
                </p>
                <p className="admin-detail-hero__meta">
                  작성 {formatDateTime(contract.createdAt)}
                </p>
              </div>
              <div className="admin-detail-hero__aside">
                <span className="admin-status">
                  {getContractStatusLabel(contract.status)}
                </span>
                <p className="admin-detail-hero__amount">
                  {formatAmount(contract.contractAmount)}
                </p>
              </div>
            </section>

            <div className="admin-detail-grid">
              <section className="admin-detail-card">
                <h2 className="app-section-title">계약 정보</h2>
                <div className="admin-detail-card__body">
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
                </div>
              </section>

              {purchasePayload ? (
                <PurchaseContractDetails payload={purchasePayload} />
              ) : (
                <>
                  <section className="admin-detail-card">
                    <h2 className="app-section-title">고객 정보</h2>
                    <div className="admin-detail-card__body">
                      <DetailItem label="고객명" value={contract.customerName} />
                      <DetailItem label="연락처" value={contract.customerPhone} />
                      <DetailItem label="주소" value={contract.customerAddress} />
                      <DetailItem label="서명명" value={contract.signatureName} />
                    </div>
                  </section>

                  <section className="admin-detail-card">
                    <h2 className="app-section-title">계약 내용</h2>
                    <div className="admin-detail-card__body">
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
                    </div>
                  </section>
                </>
              )}

              {purchasePayload ? (
                <section className="admin-detail-card">
                  <h2 className="app-section-title">서명 / 동의</h2>
                  <div className="admin-detail-card__body">
                    <DetailItem label="서명명" value={contract.signatureName} />
                    <DetailItem
                      label="약관 동의"
                      value={contract.termsAgreed ? "동의함" : "미동의"}
                    />
                  </div>
                </section>
              ) : null}
            </div>

            {purchasePayload && documentValues ? (
              <div
                ref={pdfCaptureRef}
                className="contract-doc__pdf-capture"
                aria-hidden="true"
              >
                <ContractDocumentView values={documentValues} />
              </div>
            ) : null}

            <div className="admin-detail-stack">
              {purchasePayload ? (
                <section className="admin-detail-card admin-action-card">
                  <h2 className="app-section-title">다운로드</h2>
                  <div className="admin-action-group">
                    <p className="admin-action-group__title">계약서 PDF</p>
                    <p className="admin-action-group__description">
                      고객이 작성한 구매 계약서를 A4 PDF로 내려받을 수 있습니다.
                    </p>
                    <div className="admin-detail-actions admin-detail-actions--start">
                      <button
                        type="button"
                        className="app-button"
                        disabled={isDownloadingPdf}
                        onClick={() => {
                          if (!contract || !pdfCaptureRef.current) {
                            return;
                          }

                          void (async () => {
                            setIsDownloadingPdf(true);
                            setError("");

                            try {
                              await exportContractDocumentToPdf(
                                pdfCaptureRef.current as HTMLElement,
                                buildContractPdfFilename(contract.contractNumber),
                              );
                            } catch {
                              setError("PDF 다운로드에 실패했습니다.");
                            } finally {
                              setIsDownloadingPdf(false);
                            }
                          })();
                        }}
                      >
                        {isDownloadingPdf
                          ? "다운로드 중..."
                          : "계약서 PDF 다운로드"}
                      </button>
                    </div>
                  </div>

                  <div className="admin-action-group">
                    <p className="admin-action-group__title">PlayAuto 주문 엑셀</p>
                    <p className="admin-action-group__description">
                      고객이 입력한 정보를 PlayAuto 신규주문 업로드 양식으로
                      내려받을 수 있습니다.
                    </p>
                    <div className="admin-detail-actions admin-detail-actions--start">
                      <button
                        type="button"
                        className="app-button"
                        disabled={isDownloading}
                        onClick={() => {
                          if (!contract) {
                            return;
                          }

                          void (async () => {
                            setIsDownloading(true);
                            setError("");

                            try {
                              await downloadAdminOrderExcel(contract.id);
                            } catch (downloadError) {
                              if (
                                downloadError instanceof ApiClientError &&
                                downloadError.status === 401
                              ) {
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
                          })();
                        }}
                      >
                        {isDownloading ? "다운로드 중..." : "주문 엑셀 다운로드"}
                      </button>
                    </div>
                  </div>
                </section>
              ) : null}

              <section className="admin-detail-card">
                <h2 className="app-section-title">상태 변경</h2>
                <div className="admin-status-form">
                  <div className="app-field">
                    <label htmlFor="status" className="app-label">
                      상태
                    </label>
                    <select
                      id="status"
                      value={selectedStatus}
                      onChange={(event) => setSelectedStatus(event.target.value)}
                      className="app-input"
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
                    className="app-button"
                    disabled={isSaving || selectedStatus === contract.status}
                    onClick={() => void handleStatusSave()}
                  >
                    {isSaving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </section>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
