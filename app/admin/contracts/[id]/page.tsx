"use client";

import {
  ApiClientError,
  downloadAdminOrderExcel,
  fetchAdminContractById,
  reissueAdminContractViewToken,
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
        <h2 className="app-section-title">구매 계약서 정보</h2>
        <div className="admin-detail-card__body">
          <DetailItem label="담당자" value={payload.managerName || "-"} />
          <DetailItem label="작성일자" value={payload.writtenDate} />
          <DetailItem label="동의 일자" value={payload.agreementDate} />
        </div>
      </section>

      <section className="admin-detail-card admin-detail-card--full">
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
  const [approvalNumber, setApprovalNumber] = useState("");
  // 서버에 저장된 승인번호. 입력값과 같을 때만 주문 엑셀을 받을 수 있다
  const [savedApprovalNumber, setSavedApprovalNumber] = useState("");
  const [isSavingApprovalNumber, setIsSavingApprovalNumber] = useState(false);
  const [isReissuingLink, setIsReissuingLink] = useState(false);
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
        setApprovalNumber(result.approvalNumber ?? "");
        setSavedApprovalNumber(result.approvalNumber ?? "");
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
      // 목록으로 이동하지 않고 이 화면에 머문다 (상단 상태 배지만 갱신)
      setContract({ ...contract, status: selectedStatus });
      window.alert("저장되었습니다.");
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
      if (reissueError instanceof ApiClientError && reissueError.status === 401) {
        router.push("/admin/login");
        return;
      }

      setError(
        reissueError instanceof ApiClientError
          ? reissueError.message
          : "링크 재발급 중 오류가 발생했습니다.",
      );
    } finally {
      setIsReissuingLink(false);
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
      window.alert("저장되었습니다.");
    } catch (saveError) {
      if (saveError instanceof ApiClientError) {
        if (saveError.status === 401) {
          router.push("/admin/login");
          return;
        }

        setError(saveError.message);
      } else {
        setError("승인번호 저장 중 오류가 발생했습니다.");
      }
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

        <header className="app-header app-header--page">
          <img
            className="app-brand"
            src="https://icilamaison.com/26renewer/resource/image/logo_black.svg"
            alt="이씨라메종"
          />
          <h1 className="app-title app-title--page">계약서 상세</h1>
          <p className="app-description">제출된 계약 정보 및 처리 상태</p>
        </header>

        {error ? <p className="app-alert app-alert--error">{error}</p> : null}

        {isLoading ? (
          <p className="app-empty">상세 정보를 불러오는 중...</p>
        ) : contract ? (
          <>
            <div className="admin-detail-content">
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
                <h2 className="app-section-title">관리 정보</h2>
                <div className="admin-detail-card__body">
                  <DetailItem
                    label="최종 수정일"
                    value={formatDateTime(contract.updatedAt)}
                  />
                  <DetailItem
                    label="작성자 계정"
                    value={
                      contract.createdByUsername
                        ? contract.createdByName
                          ? `${contract.createdByName} (${contract.createdByUsername})`
                          : contract.createdByUsername
                        : "-"
                    }
                  />
                  <DetailItem
                    label="수정 이력"
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
                  {purchasePayload ? (
                    <div className="admin-detail-actions admin-detail-actions--start">
                      <button
                        type="button"
                        className="app-button app-button--secondary"
                        onClick={() => router.push(`/contract/write?edit=${contract.id}`)}
                      >
                        계약서 수정
                      </button>
                    </div>
                  ) : null}
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
                      label="서명"
                      value={
                        purchasePayload.signatureDataUrl ? (
                          <img
                            className="admin-signature-image"
                            src={purchasePayload.signatureDataUrl}
                            alt="구매자 서명"
                          />
                        ) : (
                          "-"
                        )
                      }
                    />
                    <DetailItem
                      label="약관 동의"
                      value={contract.termsAgreed ? "동의함" : "미동의"}
                    />
                    <DetailItem
                      label="마케팅 동의"
                      value={purchasePayload.marketingConsentAgreed ? "동의함" : "미동의"}
                    />
                    {/* 러그 3·4호를 고른 계약서만 받는 동의 */}
                    {getRugNoticeChecks(purchasePayload.products).map(({ field }) => (
                      <DetailItem
                        key={field}
                        label={RUG_CHECK_LABELS[field]}
                        value={purchasePayload[field] ? "확인함" : "미확인"}
                      />
                    ))}
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

            {purchasePayload && documentValues ? (
              <div
                ref={pdfCaptureRef}
                className="contract-doc__pdf-capture"
                aria-hidden="true"
              >
                <ContractPdfDocument values={documentValues} />
              </div>
            ) : null}

            <div className="admin-detail-stack">
              {purchasePayload ? (
                <section className="admin-detail-card">
                  {/* 다른 카드(상태 변경 등)와 같은 섹션 제목 */}
                  <h2 className="app-section-title">계약서 및 파일 관리</h2>

                  <ul className="admin-file-list">
                    {/* 관리자용 계약서 */}
                    <li className="admin-file-item">
                      <div className="admin-file-item__text">
                        <p className="admin-file-item__title">관리자용 계약서</p>
                        <p className="admin-file-item__description">
                          관리자만 볼 수 있는 계약서입니다. 고객용 링크 유효기간과 상관없이 언제든 확인하고 PDF로 받을 수 있습니다.
                        </p>
                      </div>
                      <div className="admin-file-item__actions">
                        {/* 관리자 전용 보기: 고객용 링크 유효기간과 상관없이 열린다 */}
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
                          계약서 웹으로 보기
                        </button>
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
                          {isDownloadingPdf ? "다운로드 중..." : "계약서 PDF 다운로드"}
                        </button>
                      </div>
                    </li>

                    {/* 고객용 계약서 */}
                    <li className="admin-file-item">
                      <div className="admin-file-item__text">
                        <p className="admin-file-item__title">고객용 계약서</p>
                        <p className="admin-file-item__description">
                          고객에게 보내는 계약서 링크입니다. 발급일부터 90일간 열리며, 재발급하면 이전 링크는 더 이상 열리지 않습니다.
                        </p>
                        <p className={`admin-link-expiry${isCustomerLinkExpired ? " is_expired" : ""}`}>
                          {contract.viewTokenExpiresAt
                            ? `유효기간 ${new Date(contract.viewTokenExpiresAt).toLocaleDateString("ko-KR")} 까지${isCustomerLinkExpired ? " (만료됨)" : ""}`
                            : "발급된 링크 없음"}
                        </p>
                      </div>
                      <div className="admin-file-item__actions">
                        {contract.viewToken && !isCustomerLinkExpired ? (
                          <>
                            {/* 고객이 받는 화면 그대로 확인 (만료되면 고객과 같이 안 열리므로 숨김) */}
                            <button
                              type="button"
                              className="app-button app-button--secondary"
                              onClick={() => {
                                window.open(customerLinkUrl, "_blank", "noopener,noreferrer");
                              }}
                            >
                              계약서 웹으로 보기
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
                          </>
                        ) : null}
                        <button
                          type="button"
                          className="app-button app-button--secondary"
                          disabled={isReissuingLink}
                          onClick={() => {
                            void handleReissueCustomerLink();
                          }}
                        >
                          {isReissuingLink ? "발급 중..." : "링크 재발급"}
                        </button>
                      </div>
                    </li>

                    {/* PlayAuto 주문 엑셀 */}
                    <li className="admin-file-item admin-file-item--stacked">
                      <div className="admin-file-item__text">
                        <p className="admin-file-item__title">PlayAuto 주문 엑셀</p>
                        <p className="admin-file-item__description">
                          승인번호를 등록한 후 주문 엑셀 파일을 다운로드할 수 있습니다.
                        </p>
                        <div className="admin-detail-actions admin-file-item__form">
                          <div className="app-field">
                            <label htmlFor="approval-number" className="app-label">
                              승인번호
                            </label>
                            <div className="admin-approval-input">
                              <span aria-hidden="true">SR</span>
                              <input
                                id="approval-number"
                                type="text"
                                inputMode="numeric"
                                value={approvalNumber}
                                onChange={(event) =>
                                  setApprovalNumber(
                                    event.target.value.replace(/\D/g, ""),
                                  )
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
                          <button
                            type="button"
                            className="app-button"
                            disabled={isDownloading || !isApprovalNumberSaved}
                            title={isApprovalNumberSaved ? undefined : "승인번호를 저장해야 다운로드할 수 있습니다."}
                            onClick={() => {
                              if (!contract || !isApprovalNumberSaved) {
                                return;
                              }

                              void (async () => {
                                setIsDownloading(true);
                                setError("");

                                try {
                                  await downloadAdminOrderExcel(
                                    contract.id,
                                    approvalNumber,
                                  );
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
                    </li>
                  </ul>
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
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
