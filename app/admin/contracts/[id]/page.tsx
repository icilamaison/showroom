"use client";

import {
  ApiClientError,
  downloadAdminOrderExcel,
  fetchAdminContractById,
  reissueAdminContractViewToken,
  sendAdminContractSms,
  updateAdminContractApprovalNumber,
  updateAdminContractStatus,
  type ContractDetail,
} from "@/lib/api-client";
import {
  CONTRACT_STATUSES,
  getContractStatusLabel,
} from "@/lib/constants/contract-status";
import { formatFullAddress } from "@/lib/address";
import { findCatalogProductByName, resolveCafe24Variant } from "@/lib/product-catalog";
import { formatSetOptionLabel } from "@/lib/set-product";
import { getRugNoticeChecks, type PurchaseContractPayload } from "@/lib/validation/contract";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import ContractPdfDocument from "@/app/contract/ContractPdfDocument";
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ko-KR");
}

/** 고객용 링크 남은 일수. 만료면 음수 */
function getLinkDaysRemaining(expiresAt: string | null | undefined) {
  if (!expiresAt) {
    return null;
  }

  const end = new Date(expiresAt);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round(
    (startOfEnd.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24),
  );
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
      <div className="admin-product-table-wrap">
        <table className="admin-product-table">
          <thead>
            <tr>
              <th>상품번호</th>
              <th>상품명</th>
              <th>타입</th>
              <th>컬러</th>
              <th>사이즈</th>
              <th>수량</th>
              <th>단가</th>
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            {filledProducts.map((product, index) => (
              <tr key={`${product.name}-${index}`}>
                {/* 묶어 고른 상품(포그 매트 / 스톤블랙)은 실제 카페24 상품(포그 매트 스톤블랙)으로 되돌려 번호를 찾는다 */}
                <td>
                  {findCatalogProductByName(
                    resolveCafe24Variant(product.name, product.color, product.size).productName,
                  )?.productNo ?? "-"}
                </td>
                <td>{product.name}</td>
                <td>{product.type?.trim() ? product.type : "-"}</td>
                <td>{formatSetOptionLabel(product.color) || "-"}</td>
                <td>{product.size || "-"}</td>
                <td>{product.quantity}</td>
                <td>
                  {product.unitPrice
                    ? `${Number(product.unitPrice).toLocaleString("ko-KR")}원`
                    : "-"}
                </td>
                <td>{product.remarks?.trim() ? product.remarks : "-"}</td>
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

// 러그 동의 항목 라벨 (계약서 문구는 라벨 칸에 비해 길어 짧게)
const RUG_CHECK_LABELS = {
  largeRugNoticeAgreed: "러그 반품 불가",
  size4DeliveryAgreed: "4호 배송 동의",
};

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
        <h2 className="app-section-title">고객 정보</h2>
        <div className="admin-detail-card__body">
          <DetailItem label="구매자" value={payload.buyerName} />
          <DetailItem label="연락처" value={payload.buyerPhone} />
          <DetailItem
            label="수령자"
            value={
              payload.recipientSameAsBuyer
                ? "구매자와 동일"
                : payload.recipientName || "-"
            }
          />
          {!payload.recipientSameAsBuyer ? (
            <DetailItem
              label="수령자 연락처"
              value={payload.recipientPhone || "-"}
            />
          ) : null}
          <DetailItem
            label="배송지"
            value={
              formatFullAddress(
                payload.recipientAddress || "",
                payload.recipientAddressDetail || "",
              ) || "-"
            }
            stacked
          />
          <DetailItem label="담당자" value={payload.managerName || "-"} />
          <DetailItem label="작성일자" value={payload.writtenDate} />
          <DetailItem label="동의 일자" value={payload.agreementDate} />
        </div>
      </section>

      <section className="admin-detail-card">
        <h2 className="app-section-title">계약 상품</h2>
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

  const queryClient = useQueryClient();
  const detailQueryKey = ["adminContract", contractId];
  // 한 번 본 계약서는 캐시로 바로 보여주고 뒤에서 갱신한다 (개인정보가 많아 localStorage에는 저장하지 않음, layout 참고)
  const detailQuery = useQuery({
    queryKey: detailQueryKey,
    queryFn: () => fetchAdminContractById(contractId),
    enabled: isValidId,
  });
  const contract = detailQuery.data ?? null;
  const isLoading = isValidId && detailQuery.isPending;
  const isUnauthorized =
    detailQuery.error instanceof ApiClientError && detailQuery.error.status === 401;
  const loadError = !isValidId
    ? "유효하지 않은 계약서 ID입니다."
    : !detailQuery.isError || isUnauthorized
      ? ""
      : detailQuery.error instanceof ApiClientError && detailQuery.error.status === 404
        ? "계약서를 찾을 수 없습니다."
        : "계약서 상세 정보를 불러오지 못했습니다.";

  // 저장·재발급 결과를 캐시에 바로 반영해 다시 들어와도 최신 값이 보이게 한다
  function setContract(next: ContractDetail) {
    queryClient.setQueryData(detailQueryKey, next);
  }

  const [selectedStatus, setSelectedStatus] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [approvalNumber, setApprovalNumber] = useState("");
  // 서버에 저장된 승인번호. 입력값과 같을 때만 주문 엑셀을 받을 수 있다
  const [savedApprovalNumber, setSavedApprovalNumber] = useState("");
  const [isSavingApprovalNumber, setIsSavingApprovalNumber] = useState(false);
  const [isReissuingLink, setIsReissuingLink] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const pdfCaptureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isUnauthorized) router.push("/admin/login");
  }, [isUnauthorized, router]);

  // 입력칸은 계약서별로 처음 한 번만 채운다. 뒤에서 갱신될 때 입력 중인 값을 덮어쓰지 않기 위함
  const filledContractIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!contract || filledContractIdRef.current === contract.id) return;
    filledContractIdRef.current = contract.id;
    setSelectedStatus(contract.status);
    setApprovalNumber(contract.approvalNumber ?? "");
    setSavedApprovalNumber(contract.approvalNumber ?? "");
  }, [contract]);

  // 401이면 로그인으로 보내고, 그 외에는 서버 메시지(없으면 기본 문구)를 보여준다
  function handleActionError(actionError: unknown, fallbackMessage: string) {
    if (actionError instanceof ApiClientError && actionError.status === 401) {
      router.push("/admin/login");
      return;
    }

    setError(actionError instanceof ApiClientError ? actionError.message : fallbackMessage);
  }

  async function handleStatusSave() {
    if (!isValidId || !contract) {
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await updateAdminContractStatus(contractId, selectedStatus);
      // 목록으로 이동하지 않고 이 화면에 머문다 (상단 상태 배지만 갱신)
      setContract({ ...contract, status: selectedStatus });
      window.alert("저장되었습니다.");
    } catch (saveError) {
      handleActionError(saveError, "상태 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  const customerLinkUrl =
    contract?.viewToken
      ? `${window.location.origin}/contract/view/${encodeURIComponent(contract.contractNumber)}?token=${encodeURIComponent(contract.viewToken)}`
      : "";
  const isCustomerLinkExpired = Boolean(
    contract?.viewTokenExpiresAt && new Date(contract.viewTokenExpiresAt) < new Date(),
  );

  async function handleCopyCustomerLink() {
    try {
      await navigator.clipboard.writeText(customerLinkUrl);
      window.alert("고객용 링크를 복사했습니다.");
    } catch {
      window.prompt("아래 링크를 복사해주세요.", customerLinkUrl);
    }
  }

  async function handleReissueCustomerLink() {
    if (!contract) {
      return;
    }

    if (!window.confirm("링크를 재발급하면 이전에 보낸 링크는 더 이상 열리지 않습니다. 재발급할까요?")) {
      return;
    }

    setIsReissuingLink(true);
    setError("");

    try {
      const reissued = await reissueAdminContractViewToken(contract.id);
      setContract({ ...contract, ...reissued });
      window.alert("새 링크를 발급했습니다. 링크 복사로 고객에게 다시 보내주세요.");
    } catch (reissueError) {
      handleActionError(reissueError, "링크 재발급 중 오류가 발생했습니다.");
    } finally {
      setIsReissuingLink(false);
    }
  }

  async function handleSendSms() {
    if (!contract) {
      return;
    }

    if (!window.confirm(`${contract.customerPhone} 번호로 계약서 링크를 문자로 보낼까요?`)) {
      return;
    }

    setIsSendingSms(true);
    setError("");

    try {
      const { result } = await sendAdminContractSms(contract.id);
      window.alert(
        result === "sent"
          ? "문자를 발송했습니다."
          : "발송 기능이 꺼져 있어 문자를 보내지 않았습니다.",
      );
    } catch (smsError) {
      handleActionError(smsError, "문자 발송 중 오류가 발생했습니다.");
    } finally {
      setIsSendingSms(false);
    }
  }

  async function handleApprovalNumberSave() {
    if (!contract) {
      return;
    }

    if (!approvalNumber.trim()) {
      window.alert("승인번호를 입력해주세요.");
      return;
    }

    setIsSavingApprovalNumber(true);
    setError("");

    try {
      await updateAdminContractApprovalNumber(contract.id, approvalNumber);
      setSavedApprovalNumber(approvalNumber);
      setContract({ ...contract, approvalNumber });
      window.alert("저장되었습니다.");
    } catch (saveError) {
      handleActionError(saveError, "승인번호 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSavingApprovalNumber(false);
    }
  }

  // 저장 후 입력값을 다시 바꾸면 저장 전까지 다운로드를 막는다
  const isApprovalNumberSaved =
    approvalNumber.trim() !== "" && approvalNumber === savedApprovalNumber;

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

        <header className="app-header app-header--page admin-page-header">
          <img
            className="app-brand"
            src="https://icilamaison.com/26renewer/resource/image/logo_black.svg"
            alt="이씨라메종"
          />
          <h1 className="app-title app-title--page">계약서 상세</h1>
        </header>

        {error || loadError ? (
          <p className="app-alert app-alert--error">{error || loadError}</p>
        ) : null}

        {isLoading ? (
          <p className="app-empty">상세 정보를 불러오는 중...</p>
        ) : contract ? (
          <>
            <div className="admin-detail-content">
              <section className="admin-detail-hero">
                <div className="admin-detail-hero__main">
                  <div className="admin-detail-hero__title-row">
                    <h2 className="admin-detail-hero__title">
                      {contract.customerName}
                    </h2>
                    <span className={`admin-status admin-status--${contract.status}`}>
                      {getContractStatusLabel(contract.status)}
                    </span>
                  </div>
                  <p className="admin-detail-hero__meta-row">
                    <span>{contract.contractNumber}</span>
                    <span>작성 {formatDate(contract.createdAt)}</span>
                    <span>
                      담당{" "}
                      {contract.createdByName ||
                        contract.createdByUsername ||
                        "-"}
                    </span>
                  </p>
                  <p className="admin-detail-hero__amount">
                    {formatAmount(contract.contractAmount)}
                  </p>
                </div>
                <div className="admin-detail-hero__aside">
                  <div className="admin-detail-hero__actions">
                    {purchasePayload ? (
                      <button
                        type="button"
                        className="app-button app-button--secondary"
                        onClick={() =>
                          router.push(`/contract/write?edit=${contract.id}`)
                        }
                      >
                        계약서 수정
                      </button>
                    ) : null}
                    {purchasePayload ? (
                      <button
                        type="button"
                        className="app-button app-button--secondary"
                        onClick={() => {
                          window.open(
                            `/admin/contracts/${contract.id}/view`,
                            "_blank",
                            "noopener,noreferrer",
                          );
                        }}
                      >
                        관리자용 웹 보기
                      </button>
                    ) : null}
                    {purchasePayload && documentValues ? (
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
                          : "PDF 다운로드"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </section>

              <div className="admin-detail-layout">
                <div className="admin-detail-main">
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
                          <DetailItem label="상품명/서비스명" value={contract.productName} />
                          <DetailItem label="계약 금액" value={formatAmount(contract.contractAmount)} />
                          <DetailItem label="계약 시작일" value={contract.contractStartDate} />
                          <DetailItem label="계약 종료일" value={contract.contractEndDate} />
                          <DetailItem label="특약사항" value={contract.specialTerms || "-"} />
                          <DetailItem label="약관 동의" value={contract.termsAgreed ? "동의함" : "미동의"} />
                        </div>
                      </section>
                    </>
                  )}

                  {purchasePayload ? (
                    <section className="admin-detail-card">
                      <h2 className="app-section-title">동의</h2>
                      <div className="admin-detail-card__body">
                        <DetailItem
                          label="약관 동의"
                          value={contract.termsAgreed ? "동의함" : "미동의"}
                        />
                        <DetailItem
                          label="마케팅 동의"
                          value={
                            purchasePayload.marketingConsentAgreed
                              ? "동의함"
                              : "미동의"
                          }
                        />
                        {getRugNoticeChecks(purchasePayload.products).map(
                          ({ field }) => (
                            <DetailItem
                              key={field}
                              label={RUG_CHECK_LABELS[field]}
                              value={purchasePayload[field] ? "확인함" : "미확인"}
                            />
                          ),
                        )}
                        {purchasePayload.padPurchased != null ? (
                          <DetailItem
                            label="미끄럼방지 패드"
                            value={
                              purchasePayload.padPurchased
                                ? `구매 (${purchasePayload.padQuantity || 1}개)`
                                : "미구매"
                            }
                          />
                        ) : null}
                      </div>
                    </section>
                  ) : null}
                </div>

                <aside className="admin-detail-rail">
                  <section className="admin-detail-card">
                    <h2 className="app-section-title">상태 변경</h2>
                    <div className="admin-status-form">
                      <div className="app-field">
                        <label htmlFor="status" className="app-label">상태</label>
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
                        {isSaving ? "저장 중..." : "상태 저장"}
                      </button>
                    </div>
                  </section>

                  {purchasePayload ? (
                    <>
                      <section className="admin-detail-card">
                        <h2 className="app-section-title">SR 승인번호</h2>
                        <p className="admin-rail-hint">
                          입력해야 PlayAuto 주문 엑셀을 받을 수 있어요
                        </p>
                        <div className="admin-detail-actions">
                          <div className="app-field" style={{ flex: "1 1 140px" }}>
                            <label htmlFor="approval-number" className="app-label">승인번호</label>
                            <div className="admin-approval-input">
                              <span aria-hidden="true">SR</span>
                              <input
                                id="approval-number"
                                type="text"
                                inputMode="numeric"
                                value={approvalNumber}
                                onChange={(event) =>
                                  setApprovalNumber(event.target.value.replace(/\D/g, ""))
                                }
                                className="app-input"
                                placeholder="ex) 30033857"
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            className="app-button app-button--secondary"
                            disabled={isSavingApprovalNumber}
                            onClick={() => {
                              void handleApprovalNumberSave();
                            }}
                          >
                            {isSavingApprovalNumber ? "저장 중..." : "저장"}
                          </button>
                        </div>
                        <div className="admin-rail-actions" style={{ marginTop: "0.75rem" }}>
                          <button
                            type="button"
                            className="app-button"
                            disabled={isDownloading || !isApprovalNumberSaved}
                            title={
                              isApprovalNumberSaved
                                ? undefined
                                : "승인번호를 저장해야 다운로드할 수 있습니다."
                            }
                            onClick={() => {
                              if (!contract || !isApprovalNumberSaved) {
                                return;
                              }

                              void (async () => {
                                setIsDownloading(true);
                                setError("");
                                try {
                                  await downloadAdminOrderExcel(contract.id, approvalNumber);
                                } catch (downloadError) {
                                  handleActionError(downloadError, "엑셀 다운로드에 실패했습니다.");
                                } finally {
                                  setIsDownloading(false);
                                }
                              })();
                            }}
                          >
                            {isDownloading ? "다운로드 중..." : "PlayAuto 주문 엑셀"}
                          </button>
                        </div>
                      </section>

                      <section className="admin-detail-card">
                        <h2 className="app-section-title">
                          고객 계약서 링크
                          {(() => {
                            const days = getLinkDaysRemaining(
                              contract.viewTokenExpiresAt,
                            );
                            if (days == null) return null;
                            return (
                              <span
                                className={`admin-d-day${days < 0 ? " is-expired" : ""}`}
                              >
                                {days < 0 ? "만료" : `D-${days}`}
                              </span>
                            );
                          })()}
                        </h2>
                        <p className="admin-rail-hint">
                          {contract.viewToken
                            ? isCustomerLinkExpired
                              ? "링크가 만료됐어요. 아래에서 다시 발급해 주세요."
                              : contract.viewTokenExpiresAt
                                ? `${formatDate(contract.viewTokenExpiresAt)}까지`
                                : "고객에게 보낼 수 있는 링크가 있어요."
                            : "아직 링크가 없어요. 발급하면 90일간 쓸 수 있어요."}
                        </p>

                        {contract.viewToken && !isCustomerLinkExpired && customerLinkUrl ? (
                          <div className="admin-share-link">
                            <input
                              className="app-input admin-input-compact"
                              type="text"
                              readOnly
                              value={customerLinkUrl}
                              aria-label="고객 계약서 링크"
                              onFocus={(event) => event.currentTarget.select()}
                            />
                          </div>
                        ) : null}

                        {contract.viewToken && !isCustomerLinkExpired ? (
                          <>
                            <div className="admin-rail-actions">
                              <button
                                type="button"
                                className="app-button"
                                disabled={isSendingSms}
                                onClick={() => {
                                  void handleSendSms();
                                }}
                              >
                                {isSendingSms ? "발송 중..." : "문자로 보내기"}
                              </button>
                              <button
                                type="button"
                                className="app-button app-button--secondary"
                                onClick={() => {
                                  void handleCopyCustomerLink();
                                }}
                              >
                                링크 복사
                              </button>
                              <button
                                type="button"
                                className="app-button app-button--secondary"
                                onClick={() => {
                                  window.open(
                                    customerLinkUrl,
                                    "_blank",
                                    "noopener,noreferrer",
                                  );
                                }}
                              >
                                고객 화면 열기
                              </button>
                            </div>
                            <div className="admin-rail-links">
                              <button
                                type="button"
                                disabled={isReissuingLink}
                                onClick={() => {
                                  void handleReissueCustomerLink();
                                }}
                              >
                                {isReissuingLink ? "발급 중..." : "링크 재발급"}
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="admin-rail-actions">
                            <button
                              type="button"
                              className="app-button"
                              disabled={isReissuingLink}
                              onClick={() => {
                                void handleReissueCustomerLink();
                              }}
                            >
                              {isReissuingLink
                                ? "발급 중..."
                                : contract.viewToken
                                  ? "링크 재발급"
                                  : "링크 발급하기"}
                            </button>
                          </div>
                        )}
                      </section>
                    </>
                  ) : null}

                  <section className="admin-detail-card">
                    <h2 className="app-section-title">수정 이력</h2>
                    <div className="admin-detail-card__body">
                      <DetailItem label="최종 수정" value={formatDateTime(contract.updatedAt)} />
                      <DetailItem
                        label="작성자"
                        value={
                          contract.createdByUsername
                            ? contract.createdByName
                              ? `${contract.createdByName} (${contract.createdByUsername})`
                              : contract.createdByUsername
                            : "-"
                        }
                      />
                      <DetailItem
                        label="이력"
                        stacked={Boolean(contract.edits?.length)}
                        value={
                          contract.edits?.length ? (
                            <span className="admin-edit-history">
                              {contract.edits.map((edit) => (
                                <span key={edit.editedAt}>
                                  {formatDateTime(edit.editedAt)} · {edit.editorName ?? "-"}
                                  {edit.changedFields.length
                                    ? ` · ${edit.changedFields.join(", ")}`
                                    : ""}
                                </span>
                              ))}
                            </span>
                          ) : (
                            "-"
                          )
                        }
                      />
                    </div>
                  </section>
                </aside>
              </div>

              {purchasePayload && documentValues ? (
                <div
                  ref={pdfCaptureRef}
                  className="contract-doc__pdf-capture"
                  aria-hidden="true"
                >
                  <ContractPdfDocument values={documentValues} />
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
