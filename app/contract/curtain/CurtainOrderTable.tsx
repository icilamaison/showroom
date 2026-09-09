"use client";

import NextImage from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiClientError, submitContract } from "@/lib/api-client";
import { formatAmount, formatDigits, toDigits } from "@/lib/contract-amount";
import { formatDaumAddress, openDaumPostcode } from "@/lib/daum-postcode";
import { formatPhoneInput } from "@/lib/phone";
import {
  createEmptyProductRow,
  PRODUCT_ROW_COUNT,
  validateContractForm,
  type ContractFormValues,
  type ProductRow,
} from "@/lib/validation/contract";
import { ContractConsentSection } from "../ContractConsentSection";
import { SignaturePad } from "../write/ContractForm";
import "../contract.css";
import "./curtain.css";

const ITEM_COLUMN_COUNT = 6;

// 레일 단가표 — 시트 고정값. 레일커넥터는 단가 미정(비워둠).
const RAIL_OPTIONS: { label: string; price: number | null }[] = [
  { label: "6자", price: 13200 },
  { label: "8자", price: 16000 },
  { label: "10자", price: 18500 },
  { label: "12자", price: 21000 },
  { label: "14자", price: 23800 },
  { label: "16자", price: 26000 },
  { label: "크로스브라켓", price: 3000 },
  { label: "레일커넥터", price: null },
];

type CurtainItem = {
  productName: string;
  space: string;
  style: string;
  color: string;
  curtainSize: string;
  measuredWidth: string;
  measuredHeight: string;
  amount: string;
};

function createEmptyItem(): CurtainItem {
  return {
    productName: "",
    space: "",
    style: "",
    color: "",
    curtainSize: "",
    measuredWidth: "",
    measuredHeight: "",
    amount: "",
  };
}

// 확인사항 체크 — 2·3·4번은 택1이라 radio, 5번은 복수 선택이라 checkbox.
type ConfirmChecks = {
  makeSize: "" | "recommend" | "custom";
  makeSizeCm: string;
  layers: "" | "single" | "double";
  rail: "" | "none" | "self" | "request";
  railCount: string;
  highCeiling: boolean;
  noElevator: boolean;
};

function createEmptyChecks(): ConfirmChecks {
  return {
    makeSize: "",
    makeSizeCm: "",
    layers: "",
    rail: "",
    railCount: "",
    highCeiling: false,
    noElevator: false,
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="contract-doc__error">{message}</p>;
}

// 오늘 날짜 (YYYY-MM-DD). 서버/클라이언트 시간대 차이로 인한
// hydration 불일치를 피하려고 마운트 후 채운다.
function todayValue(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

const ITEM_FIELDS: { field: keyof CurtainItem; label: string }[] = [
  { field: "productName", label: "제품명" },
  { field: "space", label: "공간" },
  { field: "style", label: "스타일\n(민자/나비)" },
  { field: "color", label: "색상" },
  { field: "curtainSize", label: "커튼 호수" },
  { field: "measuredWidth", label: "실측 가로(cm)" },
  { field: "measuredHeight", label: "실측 세로(cm)" },
];

export default function CurtainOrderTable() {
  const router = useRouter();
  const [orderDate, setOrderDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [addressError, setAddressError] = useState("");
  const [sideNote, setSideNote] = useState("");
  const [remarks, setRemarks] = useState("");
  const [refundBank, setRefundBank] = useState("");
  const [refundAccount, setRefundAccount] = useState("");
  const [refundHolder, setRefundHolder] = useState("");
  const [confirm, setConfirm] = useState<ConfirmChecks>(createEmptyChecks);
  const [items, setItems] = useState<CurtainItem[]>(() =>
    Array.from({ length: ITEM_COLUMN_COUNT }, createEmptyItem),
  );
  const [railQuantities, setRailQuantities] = useState<string[]>(() =>
    RAIL_OPTIONS.map(() => ""),
  );
  const [paymentMethod, setPaymentMethod] = useState<"card" | "bank_transfer" | "">("");
  const [cashReceiptType, setCashReceiptType] = useState<
    "income_deduction" | "expense_proof" | ""
  >("");
  const [cashReceiptPhone, setCashReceiptPhone] = useState("");
  const [cashReceiptBusinessNumber, setCashReceiptBusinessNumber] = useState("");
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [marketingConsentAgreed, setMarketingConsentAgreed] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [draftSignature, setDraftSignature] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setOrderDate(todayValue());
  }, []);

  async function handleAddressSearch() {
    setAddressError("");

    try {
      await openDaumPostcode((data) => {
        setPostalCode(data.zonecode);
        setCustomerAddress(formatDaumAddress(data));
        setAddressDetail("");
      });
    } catch (error) {
      setAddressError(
        error instanceof Error
          ? error.message
          : "주소 검색 중 오류가 발생했습니다.",
      );
    }
  }

  function handleConfirmChange<K extends keyof ConfirmChecks>(
    key: K,
    value: ConfirmChecks[K],
  ) {
    setConfirm((prev) => ({ ...prev, [key]: value }));
  }

  // 커튼 항목·레일을 기존 계약서 상품행(ProductRow)으로 옮긴다.
  // 단가가 없는 레일커넥터는 금액이 0이라 상품행에서 제외하고 payload에만 남긴다.
  function buildProductRows(): ProductRow[] {
    const rows: ProductRow[] = [];

    items.forEach((item, index) => {
      if (!item.productName.trim()) {
        return;
      }

      const sizeParts = [
        item.measuredWidth.trim() && item.measuredHeight.trim()
          ? `${item.measuredWidth.trim()}×${item.measuredHeight.trim()}cm`
          : "",
        item.curtainSize.trim() ? `${item.curtainSize.trim()}호` : "",
        item.style,
      ].filter(Boolean);

      rows.push({
        ...createEmptyProductRow(),
        name: `${index + 1}. ${item.productName.trim()}${item.space.trim() ? ` (${item.space.trim()})` : ""}`,
        color: item.color.trim(),
        size: sizeParts.join(" / "),
        quantity: "1",
        unitPrice: toDigits(item.amount),
      });
    });

    RAIL_OPTIONS.forEach((rail, index) => {
      const quantity = Number(railQuantities[index] || 0);

      if (rail.price === null || quantity < 1) {
        return;
      }

      rows.push({
        ...createEmptyProductRow(),
        name: `레일 ${rail.label}`,
        quantity: String(quantity),
        unitPrice: String(rail.price),
      });
    });

    while (rows.length < PRODUCT_ROW_COUNT) {
      rows.push(createEmptyProductRow());
    }

    return rows;
  }

  function buildFormValues(): ContractFormValues {
    const [year = "", month = "", day = ""] = orderDate.split("-");

    return {
      managerName: "",
      writtenDateYear: year,
      writtenDateMonth: month,
      writtenDateDay: day,
      buyerName: customerName,
      buyerPhone: customerPhone,
      recipientSameAsBuyer: true,
      recipientName: "",
      recipientPhone: "",
      recipientPostalCode: postalCode,
      recipientAddress: customerAddress,
      recipientAddressDetail: addressDetail,
      products: buildProductRows(),
      totalDiscountRate: "",
      paymentMethod,
      cashReceiptType,
      cashReceiptPhone,
      cashReceiptBusinessNumber,
      taxInvoiceRequested: false,
      taxInvoiceEmail: "",
      agreementDateYear: year,
      agreementDateMonth: month,
      agreementDateDay: day,
      signatureName,
      signatureDataUrl,
      termsAgreed,
      marketingConsentAgreed,
    };
  }

  // 확인사항 2·3·4번은 택1 필수. 스키마에 없는 커튼 전용 검증이라 여기서 확인한다.
  function validateConfirmChecks(): Record<string, string> {
    const errors: Record<string, string> = {};

    if (!confirm.makeSize) {
      errors.makeSize = "제작 사이즈를 선택해주세요.";
    } else if (confirm.makeSize === "custom" && !confirm.makeSizeCm) {
      errors.makeSize = "짧게 제작할 길이(cm)를 입력해주세요.";
    }

    if (!confirm.layers) {
      errors.layers = "커튼 겹수를 선택해주세요.";
    }

    if (!confirm.rail) {
      errors.rail = "기존 레일 유무 및 철거를 선택해주세요.";
    } else if (confirm.rail === "request" && !confirm.railCount) {
      errors.rail = "철거할 레일 개수를 입력해주세요.";
    }

    return errors;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const confirmErrors = validateConfirmChecks();
    const validation = validateContractForm(buildFormValues());

    if (!validation.valid || Object.keys(confirmErrors).length > 0) {
      const errors = {
        ...(validation.valid ? {} : validation.errors),
        ...confirmErrors,
      };
      setFieldErrors(errors);
      setFormError("입력값을 확인해주세요.");
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const result = await submitContract({
        ...validation.data,
        // 커튼 시트 원본 값은 payload(JSONB)에 그대로 보관한다.
        curtain: {
          orderDate,
          items,
          railQuantities,
          confirm,
          sideNote,
          remarks,
          refundBank,
          refundAccount,
          refundHolder,
          railTotal,
          itemTotal,
        },
      } as Parameters<typeof submitContract>[0]);

      router.push(
        `/contract/complete?contractNumber=${encodeURIComponent(result.contractNumber)}&viewToken=${encodeURIComponent(result.viewToken)}`,
      );
    } catch (error) {
      if (error instanceof ApiClientError) {
        setFormError(error.message);

        if (error.errors) {
          setFieldErrors(error.errors);
        }
      } else {
        setFormError("제출 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }

      setIsSubmitting(false);
    }
  }

  function handleItemChange(
    index: number,
    field: keyof CurtainItem,
    value: string,
  ) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  function handleRailChange(index: number, value: string) {
    const digits = toDigits(value);
    setRailQuantities((prev) =>
      prev.map((quantity, i) => (i === index ? digits : quantity)),
    );
  }

  const itemTotal = items.reduce(
    (sum, item) => sum + Number(toDigits(item.amount) || 0),
    0,
  );
  const railTotal = RAIL_OPTIONS.reduce((sum, rail, index) => {
    const quantity = Number(railQuantities[index] || 0);
    return sum + (rail.price ?? 0) * quantity;
  }, 0);
  const grandTotal = itemTotal + railTotal;
  // 상품 관련 오류는 products / products.0.unitPrice 처럼 키가 여러 개라 첫 건만 보여준다.
  const productErrorKey = Object.keys(fieldErrors).find(
    (key) => key === "products" || key.startsWith("products."),
  );
  const productError = productErrorKey
    ? `상품 정보를 확인해주세요. (${fieldErrors[productErrorKey]})`
    : "";

  return (
    <form
      onSubmit={handleSubmit}
      className="contract-doc contract-doc--document contract-doc--sheet curtain-doc"
      noValidate
    >
      <header className="curtain-doc__header">
        <img
          className="curtain-doc__brand"
          src="https://icilamaison.com/26renewer/resource/image/logo_black.svg"
          alt="ICILAMAISON"
        />
        <label className="curtain-doc__date">
          DATE :
          <input
            type="date"
            value={orderDate}
            onChange={(event) => setOrderDate(event.target.value)}
            className="contract-doc__inline-input curtain-doc__date-input"
          />
        </label>
      </header>

      <div className="curtain-table-scroll">
      <table className="contract-doc__table curtain-table">
        <colgroup>
          <col className="curtain-table__col-label" />
          {RAIL_OPTIONS.map((rail) => (
            <col key={rail.label} className="curtain-table__col-item" />
          ))}
        </colgroup>

        <tbody>
          <tr>
            <th scope="row">성함</th>
            <td colSpan={4}>
              <input
                type="text"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                className="contract-doc__cell-input"
              />
              <FieldError message={fieldErrors.buyerName} />
            </td>
            <th scope="row">연락처</th>
            <td colSpan={3}>
              <input
                type="text"
                value={customerPhone}
                onChange={(event) =>
                  setCustomerPhone(formatPhoneInput(event.target.value))
                }
                placeholder="010-0000-0000"
                className="contract-doc__cell-input"
              />
              <FieldError message={fieldErrors.buyerPhone} />
            </td>
          </tr>

          <tr>
            <th scope="row">주소</th>
            <td colSpan={8}>
              <div className="contract-doc__address-search">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  value={postalCode}
                  readOnly
                  className="contract-doc__cell-input contract-doc__cell-input--postal"
                  aria-label="우편번호"
                />
                <button
                  type="button"
                  className="contract-doc__address-search-button"
                  onClick={() => void handleAddressSearch()}
                >
                  주소 검색
                </button>
                <input
                  type="text"
                  value={customerAddress}
                  readOnly
                  className="contract-doc__cell-input contract-doc__cell-input--full contract-doc__cell-input--readonly"
                  aria-label="기본주소"
                />
              </div>
              <FieldError message={addressError} />
              <FieldError
                message={
                  fieldErrors.recipientPostalCode || fieldErrors.recipientAddress
                }
              />
              <input
                type="text"
                value={addressDetail}
                onChange={(event) => setAddressDetail(event.target.value)}
                className="contract-doc__cell-input contract-doc__cell-input--full contract-doc__address-detail-input"
                placeholder="동·호수 등 상세주소가 있으면 입력해주세요"
                aria-label="상세주소"
              />
            </td>
          </tr>

          {ITEM_FIELDS.map(({ field, label }, fieldIndex) => (
            <tr key={field}>
              <th scope="row" className="curtain-table__row-label">
                {label}
              </th>

              {items.map((item, index) => (
                <td key={index}>
                  {field === "style" ? (
                    <select
                      value={item.style}
                      onChange={(event) =>
                        handleItemChange(index, field, event.target.value)
                      }
                      className="contract-doc__cell-select"
                    >
                      <option value=""></option>
                      <option value="민자">민자</option>
                      <option value="나비">나비</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={item[field]}
                      onChange={(event) =>
                        handleItemChange(index, field, event.target.value)
                      }
                      className="contract-doc__cell-input"
                    />
                  )}
                </td>
              ))}

              {/* 항목 행 전체를 세로로 병합한 우측 여백 칸 */}
              {fieldIndex === 0 ? (
                <td rowSpan={ITEM_FIELDS.length + 1} colSpan={2}>
                  <textarea
                    value={sideNote}
                    onChange={(event) => setSideNote(event.target.value)}
                    className="contract-doc__cell-input curtain-table__side-note"
                  />
                </td>
              ) : null}
            </tr>
          ))}

          <tr>
            <th scope="row" className="curtain-table__row-label">
              금액
            </th>
            {items.map((item, index) => (
              <td key={index}>
                <input
                  type="text"
                  value={formatDigits(item.amount)}
                  onChange={(event) =>
                    handleItemChange(index, "amount", toDigits(event.target.value))
                  }
                  inputMode="numeric"
                  className="contract-doc__cell-input contract-doc__cell-input--numeric"
                />
              </td>
            ))}
          </tr>

          {productError ? (
            <tr>
              <td colSpan={9}>
                <FieldError message={productError} />
              </td>
            </tr>
          ) : null}

          <tr>
            <th scope="row" rowSpan={2} className="curtain-table__row-label">
              레일
            </th>
            {RAIL_OPTIONS.map((rail) => (
              <td key={rail.label} className="curtain-table__rail-head">
                <span className="curtain-table__rail-name">{rail.label}</span>
                <span className="curtain-table__rail-price">
                  {rail.price === null ? "" : formatAmount(rail.price)}
                </span>
              </td>
            ))}
          </tr>
          <tr>
            {RAIL_OPTIONS.map((rail, index) => (
              <td key={rail.label}>
                <input
                  type="text"
                  value={railQuantities[index]}
                  onChange={(event) => handleRailChange(index, event.target.value)}
                  inputMode="numeric"
                  className="contract-doc__cell-input contract-doc__cell-input--qty"
                />
              </td>
            ))}
          </tr>

          <tr>
            <td colSpan={9} className="curtain-table__total">
              총 결제 금액 : ₩ {formatAmount(grandTotal)}
            </td>
          </tr>

          <tr>
            <th scope="row" className="curtain-table__row-label">
              확인사항
            </th>
            <td colSpan={8} className="curtain-table__notice">
              <p className="curtain-notice__lead">
                본 상품은 주문 제작 상품으로, 변심에 의한 교환·반품이 불가합니다.
              </p>

              <h3 className="curtain-notice__title">1. 해피콜 및 사이즈 확정</h3>
              <p className="curtain-notice__text">
                - 영업일 기준 3일 내 해피콜을 통해 최종 사이즈를 확정합니다.
                <br />- 사이즈 변경 시 최종 견적 금액이 변동될 수 있습니다.
                <br />- 사이즈 확정 후에는 변경 및 반품이 불가합니다.
              </p>

              <h3 className="curtain-notice__title">2. 제작 사이즈</h3>
              <label className="curtain-notice__check">
                <input
                  type="radio"
                  name="makeSize"
                  checked={confirm.makeSize === "recommend"}
                  onChange={() => handleConfirmChange("makeSize", "recommend")}
                />
                실측 사이즈에서 5cm 짧게 제작 (권장)
              </label>
              <label className="curtain-notice__check">
                <input
                  type="radio"
                  name="makeSize"
                  checked={confirm.makeSize === "custom"}
                  onChange={() => handleConfirmChange("makeSize", "custom")}
                />
                실측 사이즈에서
                <input
                  type="text"
                  value={confirm.makeSizeCm}
                  onChange={(event) =>
                    handleConfirmChange("makeSizeCm", toDigits(event.target.value))
                  }
                  inputMode="numeric"
                  className="contract-doc__inline-input curtain-notice__blank"
                />
                cm 짧게 제작
              </label>

              <FieldError message={fieldErrors.makeSize} />

              <h3 className="curtain-notice__title">3. 커튼 겹수 선택</h3>
              <label className="curtain-notice__check">
                <input
                  type="radio"
                  name="layers"
                  checked={confirm.layers === "single"}
                  onChange={() => handleConfirmChange("layers", "single")}
                />
                1중 커튼 (커튼 1종)
              </label>
              <label className="curtain-notice__check">
                <input
                  type="radio"
                  name="layers"
                  checked={confirm.layers === "double"}
                  onChange={() => handleConfirmChange("layers", "double")}
                />
                2중 커튼 (속커튼 + 겉커튼) — 커튼박스 폭 15cm 이상 필요
              </label>

              <FieldError message={fieldErrors.layers} />

              <h3 className="curtain-notice__title">4. 기존 레일 유무 및 철거</h3>
              <label className="curtain-notice__check">
                <input
                  type="radio"
                  name="rail"
                  checked={confirm.rail === "none"}
                  onChange={() => handleConfirmChange("rail", "none")}
                />
                기존 레일 없음
              </label>
              <label className="curtain-notice__check">
                <input
                  type="radio"
                  name="rail"
                  checked={confirm.rail === "self"}
                  onChange={() => handleConfirmChange("rail", "self")}
                />
                고객이 시공 전 직접 철거 완료
              </label>
              <label className="curtain-notice__check">
                <input
                  type="radio"
                  name="rail"
                  checked={confirm.rail === "request"}
                  onChange={() => handleConfirmChange("rail", "request")}
                />
                철거 서비스 요청 — 레일
                <input
                  type="text"
                  value={confirm.railCount}
                  onChange={(event) =>
                    handleConfirmChange("railCount", toDigits(event.target.value))
                  }
                  inputMode="numeric"
                  className="contract-doc__inline-input curtain-notice__blank"
                />
                개 (개당 10,000원)
              </label>

              <FieldError message={fieldErrors.rail} />

              <h3 className="curtain-notice__title">5. 특수 시공 환경 (해당 시 체크)</h3>
              <label className="curtain-notice__check">
                <input
                  type="checkbox"
                  checked={confirm.highCeiling}
                  onChange={(event) =>
                    handleConfirmChange("highCeiling", event.target.checked)
                  }
                />
                층고 4m 이상
              </label>
              <label className="curtain-notice__check">
                <input
                  type="checkbox"
                  checked={confirm.noElevator}
                  onChange={(event) =>
                    handleConfirmChange("noElevator", event.target.checked)
                  }
                />
                엘리베이터 없어 계단 자재 운반
              </label>
              <p className="curtain-notice__text">
                ※ 해당 항목 체크 시 사전 협의가 필요하며 추가 비용이 발생할 수 있습니다.
              </p>
            </td>
          </tr>

          <tr>
            <th scope="row" className="curtain-table__row-label">
              비고
            </th>
            <td colSpan={8}>
              <textarea
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                className="contract-doc__cell-input curtain-table__remarks"
              />
            </td>
          </tr>

          <tr>
            <th scope="row" className="curtain-table__row-label">
              {"실측비\n환불 계좌"}
            </th>
            <th scope="col">은행</th>
            <td colSpan={2}>
              <input
                type="text"
                value={refundBank}
                onChange={(event) => setRefundBank(event.target.value)}
                className="contract-doc__cell-input"
              />
            </td>
            <th scope="col">계좌번호</th>
            <td colSpan={2}>
              <input
                type="text"
                value={refundAccount}
                onChange={(event) => setRefundAccount(event.target.value)}
                className="contract-doc__cell-input"
              />
            </td>
            <th scope="col">예금주</th>
            <td>
              <input
                type="text"
                value={refundHolder}
                onChange={(event) => setRefundHolder(event.target.value)}
                className="contract-doc__cell-input"
              />
            </td>
          </tr>

          <tr>
            <th scope="row" className="curtain-table__row-label">
              배송 안내
            </th>
            <td colSpan={8} className="curtain-table__delivery">
              쇼룸 구입 후 최대 3일 이내 해피콜 진행 / 해피콜 이후 1주 이내
              출고(주말,공휴일 제외) 됩니다.
              <br />
              주문량이 많거나 상품의 특성에 따라 발송 기간이 다소 지연될 수 있습니다.
            </td>
          </tr>

          <tr>
            <th scope="row" className="curtain-table__row-label">
              결제수단
            </th>
            <td colSpan={8} className="curtain-table__payment">
              <label className="curtain-notice__check">
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === "card"}
                  onChange={() => setPaymentMethod("card")}
                />
                카드
              </label>
              <label className="curtain-notice__check">
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === "bank_transfer"}
                  onChange={() => setPaymentMethod("bank_transfer")}
                />
                계좌이체
                <span className="contract-doc__muted">
                  (신한은행 140-014-980017 / 예금주 : 홈온얼스(주))
                </span>
              </label>
              {fieldErrors.paymentMethod ? (
                <p className="contract-doc__error">{fieldErrors.paymentMethod}</p>
              ) : null}

              {paymentMethod === "bank_transfer" ? (
                <div className="curtain-table__cash-receipt">
                  <p className="curtain-notice__title">현금영수증 발행</p>
                  <label className="curtain-notice__check">
                    <input
                      type="radio"
                      name="cashReceiptType"
                      checked={cashReceiptType === "income_deduction"}
                      onChange={() => setCashReceiptType("income_deduction")}
                    />
                    소득공제용 (휴대폰번호
                    <input
                      type="tel"
                      value={cashReceiptPhone}
                      onChange={(event) =>
                        setCashReceiptPhone(formatPhoneInput(event.target.value))
                      }
                      className="contract-doc__inline-input contract-doc__inline-input--phone"
                      placeholder="010-0000-0000"
                    />
                    )
                  </label>
                  <label className="curtain-notice__check">
                    <input
                      type="radio"
                      name="cashReceiptType"
                      checked={cashReceiptType === "expense_proof"}
                      onChange={() => setCashReceiptType("expense_proof")}
                    />
                    지출증빙용 (사업자등록번호
                    <input
                      type="text"
                      value={cashReceiptBusinessNumber}
                      onChange={(event) =>
                        setCashReceiptBusinessNumber(event.target.value)
                      }
                      className="contract-doc__inline-input contract-doc__inline-input--biz"
                      placeholder="000-00-00000"
                    />
                    )
                  </label>
                  {fieldErrors.cashReceiptType ? (
                    <p className="contract-doc__error">{fieldErrors.cashReceiptType}</p>
                  ) : null}
                  {fieldErrors.cashReceiptPhone ? (
                    <p className="contract-doc__error">{fieldErrors.cashReceiptPhone}</p>
                  ) : null}
                  {fieldErrors.cashReceiptBusinessNumber ? (
                    <p className="contract-doc__error">
                      {fieldErrors.cashReceiptBusinessNumber}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </td>
          </tr>
        </tbody>
      </table>
      </div>

      <div className="contract-doc__agreement-box">
        <p className="contract-doc__agreement-text">
          본인은 위 주문 내역·확인사항 및 배송 안내의 내용을 모두 안내받아
          이해하였으며, 이에 동의하여 아래와 같이 서명합니다.
        </p>

        <ContractConsentSection
          termsAgreed={termsAgreed}
          marketingConsentAgreed={marketingConsentAgreed}
          onChange={(field, value) =>
            field === "termsAgreed"
              ? setTermsAgreed(value)
              : setMarketingConsentAgreed(value)
          }
          errors={fieldErrors}
        />

        <div className="contract-doc__agreement-sign">
          <span>{orderDate || "-"}</span>
          <label className="contract-doc__signature">
            <span>주문자 :</span>
            <input
              type="text"
              value={signatureName}
              onChange={(event) => setSignatureName(event.target.value)}
              className="contract-doc__signature-buyer-name"
              aria-label="서명 주문자명"
            />
            <button
              type="button"
              onClick={() => {
                setDraftSignature(signatureDataUrl);
                setIsSignatureModalOpen(true);
              }}
              className="contract-doc__signature-trigger"
              aria-label="서명 패드 열기"
            >
              <span className="contract-doc__signature-stamp-wrap">
                {signatureDataUrl ? (
                  <NextImage
                    src={signatureDataUrl}
                    alt="입력된 서명"
                    className="contract-doc__signature-stamp-image"
                    width={82}
                    height={30}
                    unoptimized
                  />
                ) : null}
                <span className="contract-doc__signature-stamp-text">(인)</span>
              </span>
            </button>
          </label>
        </div>
        {fieldErrors.signatureName || fieldErrors.signatureDataUrl ? (
          <p className="contract-doc__error">
            {fieldErrors.signatureName || fieldErrors.signatureDataUrl}
          </p>
        ) : null}
      </div>

      {formError ? <p className="app-alert app-alert--error">{formError}</p> : null}

      <button type="submit" disabled={isSubmitting} className="contract-doc__submit">
        {isSubmitting ? "제출 중..." : "주문서 제출"}
      </button>

      {isSignatureModalOpen ? (
        <div
          className="contract-doc__signature-modal-backdrop"
          role="dialog"
          aria-modal="true"
        >
          <div className="contract-doc__signature-modal">
            <p className="contract-doc__signature-modal-title">
              서명을 입력해주세요.
            </p>
            <SignaturePad value={draftSignature} onChange={setDraftSignature} />
            <div className="contract-doc__signature-modal-actions">
              <button
                type="button"
                onClick={() => setDraftSignature("")}
                className="contract-doc__signature-clear"
              >
                지우기
              </button>
              <button
                type="button"
                onClick={() => setIsSignatureModalOpen(false)}
                className="contract-doc__signature-cancel"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  setSignatureDataUrl(draftSignature);
                  setIsSignatureModalOpen(false);
                }}
                className="contract-doc__signature-save"
              >
                적용
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
