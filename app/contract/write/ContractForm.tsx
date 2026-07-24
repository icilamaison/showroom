"use client";

import NextImage from "next/image";
import { Fragment, useEffect, useRef, useState } from "react";
import {
  createEmptyProductRows,
  PRODUCT_ROW_COUNT,
  type ContractFormValues,
  type ProductRow,
} from "@/lib/validation/contract";
import {
  getSizeOptionName,
  getVariantComponents,
  type CatalogProduct,
} from "@/lib/product-catalog";
import {
  applyTotalDiscount,
  contractTotal,
  formatAmount,
  formatDigits,
  lineAmount,
  toDigits,
} from "@/lib/contract-amount";
import type { SetComponentSelection } from "@/lib/set-product";
import { createSetComponentSelections } from "@/lib/set-product";
import AddressSearchFields from "./AddressSearchFields";
import ProductNameAutocomplete from "./ProductNameAutocomplete";
import ProductOptionSelect from "./ProductOptionSelect";
import SetProductComponents from "./SetProductComponents";
import { ContractConsentSection } from "../ContractConsentSection";
import { ContractCompanyFooterContent } from "../ContractCompanyFooter";
import "./../contract.css";

const CATALOG_DROPDOWN_ROW_LIMIT = 5;

export const emptyContractFormValues: ContractFormValues = {
  managerName: "",
  writtenDateYear: "",
  writtenDateMonth: "",
  writtenDateDay: "",
  buyerName: "",
  buyerPhone: "",
  recipientSameAsBuyer: false,
  recipientName: "",
  recipientPhone: "",
  recipientPostalCode: "",
  recipientAddress: "",
  recipientAddressDetail: "",
  products: createEmptyProductRows(),
  totalDiscountRate: "",
  paymentMethod: "card",
  cashReceiptType: "",
  cashReceiptPhone: "",
  cashReceiptBusinessNumber: "",
  taxInvoiceRequested: false,
  taxInvoiceEmail: "",
  agreementDateYear: "",
  agreementDateMonth: "",
  agreementDateDay: "",
  signatureName: "",
  signatureDataUrl: "",
  termsAgreed: false,
  marketingConsentAgreed: false,
};

export function createInitialContractFormValues(): ContractFormValues {
  const today = new Date();

  return {
    ...emptyContractFormValues,
    writtenDateYear: String(today.getFullYear()),
    writtenDateMonth: String(today.getMonth() + 1),
    writtenDateDay: String(today.getDate()),
    agreementDateYear: String(today.getFullYear()),
    agreementDateMonth: String(today.getMonth() + 1),
    agreementDateDay: String(today.getDate()),
  };
}

type ContractFormProps = {
  values: ContractFormValues;
  errors?: Record<string, string>;
  isSubmitting?: boolean;
  productSelections?: Record<number, CatalogProduct | null>;
  setComponentSelections?: Record<number, SetComponentSelection[]>;
  onChange: (
    field: keyof ContractFormValues,
    value: string | boolean | null,
  ) => void;
  onProductChange: (
    index: number,
    field: keyof ProductRow,
    value: string,
  ) => void;
  onProductSelect: (index: number, product: CatalogProduct) => void;
  onAddProductRow: () => void;
  onRemoveLastProductRow: () => void;
  onSetComponentChange: (
    index: number,
    componentIndex: number,
    field: keyof SetComponentSelection,
    value: string,
  ) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="contract-doc__error">{message}</p>;
}

function DateFields({
  prefix,
  year,
  month,
  day,
  onChange,
  errors,
}: {
  prefix: "writtenDate" | "agreementDate";
  year: string;
  month: string;
  day: string;
  onChange: (field: keyof ContractFormValues, value: string) => void;
  errors?: Record<string, string>;
}) {
  const yearField = `${prefix}Year` as keyof ContractFormValues;
  const monthField = `${prefix}Month` as keyof ContractFormValues;
  const dayField = `${prefix}Day` as keyof ContractFormValues;

  return (
    <span className="contract-doc__date-group">
      <input
        type="text"
        inputMode="numeric"
        maxLength={4}
        value={year}
        onChange={(event) => onChange(yearField, event.target.value)}
        className="contract-doc__date-input contract-doc__date-input--year"
        aria-label={`${prefix} year`}
      />
      <span>년</span>
      <input
        type="text"
        inputMode="numeric"
        maxLength={2}
        value={month}
        onChange={(event) => onChange(monthField, event.target.value)}
        className="contract-doc__date-input contract-doc__date-input--md"
        aria-label={`${prefix} month`}
      />
      <span>월</span>
      <input
        type="text"
        inputMode="numeric"
        maxLength={2}
        value={day}
        onChange={(event) => onChange(dayField, event.target.value)}
        className="contract-doc__date-input contract-doc__date-input--md"
        aria-label={`${prefix} day`}
      />
      <span>일</span>
      <FieldError message={errors?.[`${prefix}Day`]} />
    </span>
  );
}

function DocCheckbox({
  checked,
  label,
  onChange,
  name,
}: {
  checked: boolean;
  label: React.ReactNode;
  onChange: () => void;
  name: string;
}) {
  return (
    <label className="contract-doc__checkbox">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        className="contract-doc__checkbox-input"
      />
      <span className="contract-doc__checkbox-box" aria-hidden="true">
        [{checked ? "✓" : " "}]
      </span>
      <span>{label}</span>
    </label>
  );
}

function SignaturePad({
  value,
  onChange,
}: {
  value?: string;
  onChange: (value: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#030712";
    context.clearRect(0, 0, width, height);

    if (!value) {
      return;
    }

    const image = new Image();
    image.onload = () => {
      context.drawImage(image, 0, 0, width, height);
    };
    image.src = value;
  }, [value]);

  function getPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const point = getPoint(event);
    if (!canvas || !context || !point) {
      return;
    }

    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(point.x, point.y);
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) {
      return;
    }

    const context = canvasRef.current?.getContext("2d");
    const point = getPoint(event);
    if (!context || !point) {
      return;
    }

    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function endDrawing() {
    if (!drawingRef.current) {
      return;
    }

    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    onChange(canvas.toDataURL("image/png"));
  }

  return (
    <div className="contract-doc__signature-pad-wrap">
      <canvas
        ref={canvasRef}
        className="contract-doc__signature-pad"
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={endDrawing}
        onPointerLeave={endDrawing}
        style={{ touchAction: "none" }}
        aria-label="구매자 전자서명"
      />
    </div>
  );
}

export default function ContractForm({
  values,
  errors = {},
  isSubmitting = false,
  productSelections = {},
  setComponentSelections = {},
  onChange,
  onProductChange,
  onProductSelect,
  onAddProductRow,
  onRemoveLastProductRow,
  onSetComponentChange,
  onSubmit,
}: ContractFormProps) {
  const productsSubtotal = contractTotal(values.products);
  const finalTotal = applyTotalDiscount(productsSubtotal, values.totalDiscountRate);
  const isSubmitDisabled = !values.termsAgreed || isSubmitting;
  const showBankTransferFields = values.paymentMethod === "bank_transfer";
  const recipientNameDisabled = values.recipientSameAsBuyer === true;
  const recipientPhoneDisabled = values.recipientSameAsBuyer === true;
  const displayedRecipientName = recipientNameDisabled
    ? values.buyerName
    : values.recipientName;
  const displayedRecipientPhone = recipientPhoneDisabled
    ? values.buyerPhone
    : values.recipientPhone;
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [draftSignature, setDraftSignature] = useState(values.signatureDataUrl || "");

  function openSignatureModal() {
    setDraftSignature(values.signatureDataUrl || "");
    setIsSignatureModalOpen(true);
  }

  function closeSignatureModal() {
    setIsSignatureModalOpen(false);
  }

  function saveSignature() {
    onChange("signatureDataUrl", draftSignature);
    closeSignatureModal();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="contract-doc contract-doc--document contract-doc--sheet"
      noValidate
    >
      <header className="contract-doc__header">
        <div className="contract-doc__brand">
          <img
            className="contract-doc__brand-name"
            src="https://icilamaison.com/26renewer/resource/image/logo_black.svg"
            alt="이씨라메종"
          />
          <span className="contract-doc__brand-contact">
            쇼룸 070-4149-9149 | 고객센터 02-6949-3223 | icilamaison.com
          </span>
        </div>

        <h1 className="contract-doc__title">구매 계약서 (거래명세서)</h1>

        <div className="contract-doc__meta">
          <label className="contract-doc__meta-item">
            <span>담당자 :</span>
            <input
              type="text"
              value={values.managerName}
              onChange={(event) => onChange("managerName", event.target.value)}
              className="contract-doc__inline-input"
            />
          </label>
          <label className="contract-doc__meta-item">
            <span>작성일자 :</span>
            <DateFields
              prefix="writtenDate"
              year={values.writtenDateYear}
              month={values.writtenDateMonth}
              day={values.writtenDateDay}
              onChange={onChange}
              errors={errors}
            />
          </label>
        </div>
        <FieldError message={errors.managerName} />
      </header>

      <section className="contract-doc__section">
        <h2 className="contract-doc__section-title">구매자 정보</h2>
        <table className="contract-doc__table">
          <tbody>
            <tr>
              <th scope="row">성명</th>
              <td>
                <input
                  type="text"
                  value={values.buyerName}
                  onChange={(event) => onChange("buyerName", event.target.value)}
                  className="contract-doc__cell-input"
                />
                <FieldError message={errors.buyerName} />
              </td>
              <th scope="row">연락처</th>
              <td>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={values.buyerPhone}
                  onChange={(event) => onChange("buyerPhone", event.target.value)}
                  className="contract-doc__cell-input"
                  placeholder="010-0000-0000"
                />
                <FieldError message={errors.buyerPhone} />
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="contract-doc__section">
        <div className="contract-doc__section-heading">
          <h2 className="contract-doc__section-title">수령자 정보 :</h2>
          <div className="contract-doc__option-group">
            <DocCheckbox
              name="recipientSameAsBuyer"
              checked={values.recipientSameAsBuyer === true}
              label="구매자와 동일"
              onChange={() => onChange("recipientSameAsBuyer", true)}
            />
            <DocCheckbox
              name="recipientSeparate"
              checked={values.recipientSameAsBuyer === false}
              label="아래에 별도 입력"
              onChange={() => onChange("recipientSameAsBuyer", false)}
            />
          </div>
        </div>
        <FieldError message={errors.recipientSameAsBuyer} />

        <table className="contract-doc__table">
          <tbody>
            <tr>
              <th scope="row">성명</th>
              <td>
                <input
                  type="text"
                  value={displayedRecipientName}
                  onChange={(event) =>
                    onChange("recipientName", event.target.value)
                  }
                  className="contract-doc__cell-input"
                  disabled={recipientNameDisabled}
                  readOnly={recipientNameDisabled}
                />
                <FieldError message={errors.recipientName} />
              </td>
              <th scope="row">연락처</th>
              <td>
                <input
                  type="tel"
                  inputMode="tel"
                  value={displayedRecipientPhone}
                  onChange={(event) =>
                    onChange("recipientPhone", event.target.value)
                  }
                  className="contract-doc__cell-input"
                  disabled={recipientPhoneDisabled}
                  readOnly={recipientPhoneDisabled}
                  placeholder="010-0000-0000"
                />
                <FieldError message={errors.recipientPhone} />
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="contract-doc__section">
        <h2 className="contract-doc__section-title">배송지 정보</h2>
        <table className="contract-doc__table">
          <tbody>
            <AddressSearchFields
              postalCode={values.recipientPostalCode}
              address={values.recipientAddress}
              addressDetail={values.recipientAddressDetail}
              postalCodeError={errors.recipientPostalCode}
              addressError={errors.recipientAddress}
              addressDetailError={errors.recipientAddressDetail}
              onPostalCodeChange={(value) =>
                onChange("recipientPostalCode", value)
              }
              onAddressChange={(value) => onChange("recipientAddress", value)}
              onAddressDetailChange={(value) =>
                onChange("recipientAddressDetail", value)
              }
            />
          </tbody>
        </table>
      </section>

      <section className="contract-doc__section">
        <h2 className="contract-doc__section-title">상품 정보</h2>
        <FieldError message={errors.products} />
        <table className="contract-doc__table contract-doc__table--products">
          <thead>
            <tr>
              <th>No</th>
              <th>제품명</th>
              <th>컬러</th>
              <th>사이즈</th>
              <th>수량</th>
              <th>단가</th>
              <th>금액</th>
            </tr>
          </thead>
          <tbody>
            {values.products.map((product, index) => {
              const selectedProduct = productSelections[index];
              const hasProductName = product.name.trim().length > 0;
              const variantName = product.color || product.size;
              const activeComponents = selectedProduct
                ? getVariantComponents(selectedProduct, variantName)
                : [];
              const isLegacySetColor = product.color.trim().startsWith("COLOR=");
              const isSet = activeComponents.length > 0;
              const useCatalogDropdowns =
                index < CATALOG_DROPDOWN_ROW_LIMIT && hasProductName && !isSet;
              const colorOptions =
                selectedProduct?.colors && !isSet
                  ? Object.keys(selectedProduct.colors).filter(
                      (name) => !selectedProduct.soldOutColors?.includes(name),
                    )
                  : [];
              const hasColorVariants = colorOptions.length > 0;
              const sizeOptions = isSet
                ? []
                : selectedProduct?.sizes?.filter(
                    (option) =>
                      !selectedProduct.soldOutSizes?.includes(getSizeOptionName(option)),
                  );

              return (
              <Fragment key={index}>
              <tr>
                <td className="contract-doc__row-no">{index + 1}</td>
                <td>
                  <ProductNameAutocomplete
                    value={product.name}
                    onChange={(value) => onProductChange(index, "name", value)}
                    onSelect={(selected) => onProductSelect(index, selected)}
                  />
                </td>
                <td className="contract-doc__product-color-cell">
                  {isSet && isLegacySetColor ? (
                    <span className="contract-doc__set-option-name">
                      {product.color || "구성 선택"}
                    </span>
                  ) : useCatalogDropdowns && hasColorVariants ? (
                    <div className="contract-doc__variant-picker">
                      <ProductOptionSelect
                        value={product.color}
                        options={colorOptions}
                        onChange={(value) => onProductChange(index, "color", value)}
                        placeholder="세트 구성 선택"
                        className="contract-doc__cell-select--variant"
                      />
                    </div>
                  ) : isSet ? (
                    <span className="contract-doc__set-option-name">
                      {product.color || "구성 선택"}
                    </span>
                  ) : useCatalogDropdowns && colorOptions.length > 0 ? (
                    <ProductOptionSelect
                      value={product.color}
                      options={colorOptions}
                      onChange={(value) => onProductChange(index, "color", value)}
                    />
                  ) : (
                    <input
                      type="text"
                      value={product.color}
                      onChange={(event) =>
                        onProductChange(index, "color", event.target.value)
                      }
                      className="contract-doc__cell-input"
                    />
                  )}
                </td>
                <td>
                  {isSet ? null : useCatalogDropdowns && (sizeOptions?.length ?? 0) > 0 ? (
                    <ProductOptionSelect
                      value={product.size}
                      options={sizeOptions}
                      baseSalePrice={selectedProduct?.salePrice}
                      onChange={(value) => onProductChange(index, "size", value)}
                    />
                  ) : (
                    <textarea
                      rows={1}
                      value={product.size}
                      onChange={(event) =>
                        onProductChange(index, "size", event.target.value)
                      }
                      className="contract-doc__cell-input contract-doc__cell-textarea"
                    />
                  )}
                </td>
                <td>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={product.quantity}
                    onChange={(event) =>
                      onProductChange(index, "quantity", event.target.value)
                    }
                    className="contract-doc__cell-input contract-doc__cell-input--qty"
                  />
                  <FieldError message={errors[`products.${index}.quantity`]} />
                </td>
                <td>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatDigits(product.unitPrice)}
                    onChange={(event) =>
                      onProductChange(
                        index,
                        "unitPrice",
                        toDigits(event.target.value),
                      )
                    }
                    className="contract-doc__cell-input contract-doc__cell-input--numeric"
                  />
                  <FieldError message={errors[`products.${index}.unitPrice`]} />
                </td>
                <td>
                  <span className="contract-doc__cell-input contract-doc__cell-input--numeric contract-doc__amount">
                    {lineAmount(product) > 0
                      ? formatAmount(lineAmount(product))
                      : ""}
                  </span>
                </td>
              </tr>
              {isSet && activeComponents.length
                ? (() => {
                    const components = activeComponents;

                    return (
                      <SetProductComponents
                        rowIndex={index}
                        components={components}
                        selections={
                          setComponentSelections[index] ??
                          createSetComponentSelections(components)
                        }
                        onChange={(componentIndex, field, value) =>
                          onSetComponentChange(index, componentIndex, field, value)
                        }
                      />
                    );
                  })()
                : null}
              </Fragment>
            );
            })}
            <tr className="contract-doc__total-row">
              <td colSpan={6} className="contract-doc__total-label">
                소계
              </td>
              <td className="contract-doc__total-value">
                {formatAmount(productsSubtotal)}
              </td>
            </tr>
            <tr className="contract-doc__total-row">
              <td colSpan={6} className="contract-doc__total-label">
                전체 할인율
              </td>
              <td className="contract-doc__total-value">
                <input
                  type="text"
                  inputMode="decimal"
                  value={values.totalDiscountRate}
                  onChange={(event) =>
                    onChange(
                      "totalDiscountRate",
                      event.target.value.replace(/[^\d.]/g, ""),
                    )
                  }
                  className="contract-doc__total-discount-input"
                  placeholder="0"
                />
                %
                {productsSubtotal - finalTotal > 0 ? (
                  <span className="contract-doc__total-discount-amount">
                    (-{formatAmount(productsSubtotal - finalTotal)})
                  </span>
                ) : null}
                <FieldError message={errors.totalDiscountRate} />
              </td>
            </tr>
            <tr className="contract-doc__total-row">
              <td colSpan={6} className="contract-doc__total-label">
                합계
              </td>
              <td className="contract-doc__total-value">
                {formatAmount(finalTotal)}
              </td>
            </tr>
          </tbody>
        </table>
        <div className="contract-doc__row-actions">
          <button
            type="button"
            className="contract-doc__row-action-button"
            onClick={onAddProductRow}
          >
            상품 추가
          </button>
          {values.products.length > PRODUCT_ROW_COUNT ? (
            <button
              type="button"
              className="contract-doc__row-action-button"
              onClick={onRemoveLastProductRow}
            >
              마지막 행 삭제
            </button>
          ) : null}
        </div>
      </section>

      <section className="contract-doc__section">
        <h2 className="contract-doc__section-title">결제 정보</h2>
        <table className="contract-doc__table contract-doc__table--payment">
          <tbody>
            <tr>
              <th scope="row">결제수단</th>
              <td colSpan={3}>
                <div className="contract-doc__option-group">
                  <DocCheckbox
                    name="paymentCard"
                    checked={values.paymentMethod === "card"}
                    label="카드"
                    onChange={() => onChange("paymentMethod", "card")}
                  />
                  <DocCheckbox
                    name="paymentBank"
                    checked={values.paymentMethod === "bank_transfer"}
                    label={
                      <>
                        계좌이체{" "}
                        <span className="contract-doc__muted">
                          (신한은행 140-014-980017 / 예금주 : 홈온얼스(주))
                        </span>
                      </>
                    }
                    onChange={() => onChange("paymentMethod", "bank_transfer")}
                  />
                </div>
                <FieldError message={errors.paymentMethod} />
              </td>
            </tr>
            <tr>
              <th scope="row" rowSpan={2} className="contract-doc__payment-note">
                계좌이체
                <br />
                결제 시
              </th>
              <th scope="row">현금영수증 발행</th>
              <td colSpan={2}>
                <div className="contract-doc__option-group contract-doc__option-group--stack">
                  <label className="contract-doc__checkbox">
                    <input
                      type="checkbox"
                      checked={values.cashReceiptType === "income_deduction"}
                      disabled={!showBankTransferFields}
                      onChange={() =>
                        onChange("cashReceiptType", "income_deduction")
                      }
                      className="contract-doc__checkbox-input"
                    />
                    <span className="contract-doc__checkbox-box" aria-hidden="true">
                      [{values.cashReceiptType === "income_deduction" ? "✓" : " "}]
                    </span>
                    <span>
                      소득공제용(휴대폰번호{" "}
                      <input
                        type="tel"
                        value={values.cashReceiptPhone}
                        onChange={(event) =>
                          onChange("cashReceiptPhone", event.target.value)
                        }
                        className="contract-doc__inline-input contract-doc__inline-input--phone"
                        disabled={!showBankTransferFields}
                        placeholder="010-0000-0000"
                      />
                      )
                    </span>
                  </label>
                  <label className="contract-doc__checkbox">
                    <input
                      type="checkbox"
                      checked={values.cashReceiptType === "expense_proof"}
                      disabled={!showBankTransferFields}
                      onChange={() =>
                        onChange("cashReceiptType", "expense_proof")
                      }
                      className="contract-doc__checkbox-input"
                    />
                    <span className="contract-doc__checkbox-box" aria-hidden="true">
                      [{values.cashReceiptType === "expense_proof" ? "✓" : " "}]
                    </span>
                    <span>
                      지출증빙용(사업자등록번호 :{" "}
                      <input
                        type="text"
                        value={values.cashReceiptBusinessNumber}
                        onChange={(event) =>
                          onChange(
                            "cashReceiptBusinessNumber",
                            event.target.value,
                          )
                        }
                        className="contract-doc__inline-input contract-doc__inline-input--biz"
                        disabled={
                          !showBankTransferFields || values.taxInvoiceRequested
                        }
                        placeholder="000-00-00000"
                      />
                      )
                    </span>
                  </label>
                </div>
                <FieldError message={errors.cashReceiptType} />
                <FieldError message={errors.cashReceiptPhone} />
                <FieldError message={errors.cashReceiptBusinessNumber} />
              </td>
            </tr>
            <tr>
              <th scope="row">세금계산서 발행</th>
              <td colSpan={2}>
                <label className="contract-doc__checkbox">
                  <input
                    type="checkbox"
                    checked={values.taxInvoiceRequested}
                    disabled={!showBankTransferFields}
                    onChange={(event) =>
                      onChange("taxInvoiceRequested", event.target.checked)
                    }
                    className="contract-doc__checkbox-input"
                  />
                  <span className="contract-doc__checkbox-box" aria-hidden="true">
                    [{values.taxInvoiceRequested ? "✓" : " "}]
                  </span>
                  <span>
                    사업자등록증 별도 제출 필수.
                    <span className="contract-doc__tax-email-row">
                      (세금계산서 수령 이메일 :{" "}
                      <input
                        type="email"
                        value={values.taxInvoiceEmail}
                        onChange={(event) =>
                          onChange("taxInvoiceEmail", event.target.value)
                        }
                        className="contract-doc__inline-input contract-doc__inline-input--email"
                        disabled={
                          !showBankTransferFields || !values.taxInvoiceRequested
                        }
                        placeholder="email@example.com"
                      />
                      )
                    </span>
                  </span>
                </label>
                <FieldError message={errors.taxInvoiceEmail} />
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="contract-doc__section">
        <p className="contract-doc__notice">
          ※ 운송장번호는 상품 배송이 완료된 후 카카오톡으로 별도 안내드립니다.
        </p>

        <div className="contract-doc__agreement-box">
          <p className="contract-doc__agreement-text">
            본인은 위 상품·결제·배송 정보 및 별첨 안내문(배송·교환·반품 등 안내)의
            내용을 모두 안내받아 이해하였으며, 이에 동의하여 아래와 같이 서명합니다.
          </p>

          <ContractConsentSection
            termsAgreed={values.termsAgreed}
            marketingConsentAgreed={values.marketingConsentAgreed}
            onChange={onChange}
            errors={errors}
          />

          <div className="contract-doc__agreement-sign">
            <DateFields
              prefix="agreementDate"
              year={values.agreementDateYear}
              month={values.agreementDateMonth}
              day={values.agreementDateDay}
              onChange={onChange}
              errors={errors}
            />
            <label className="contract-doc__signature">
              <span>구매자 :</span>
              <input
                type="text"
                value={values.signatureName}
                onChange={(event) =>
                  onChange("signatureName", event.target.value)
                }
                className="contract-doc__signature-buyer-name"
                aria-label="서명 구매자명"
              />
              <button
                type="button"
                onClick={openSignatureModal}
                className="contract-doc__signature-trigger"
                aria-label="서명 패드 열기"
              >
                <span className="contract-doc__signature-stamp-wrap">
                  {values.signatureDataUrl ? (
                    <NextImage
                      src={values.signatureDataUrl}
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
          <FieldError message={errors.signatureName || errors.signatureDataUrl} />
        </div>
      </section>

      <footer className="contract-doc__footer">
        <p className="contract-doc__footer-note">
          본 문서는 동일한 내용으로 2부 작성되며, 1부는 구매자 보관용, 1부는
          매장(판매자) 보관용입니다. © 이씨라메종
        </p>
        <ContractCompanyFooterContent />
      </footer>

      <button
        type="submit"
        disabled={isSubmitDisabled}
        className="contract-doc__submit"
      >
        {isSubmitting ? "제출 중..." : "계약서 제출"}
      </button>
      {isSignatureModalOpen ? (
        <div className="contract-doc__signature-modal-backdrop" role="dialog" aria-modal="true">
          <div className="contract-doc__signature-modal">
            <p className="contract-doc__signature-modal-title">서명을 입력해주세요.</p>
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
                onClick={closeSignatureModal}
                className="contract-doc__signature-cancel"
              >
                취소
              </button>
              <button
                type="button"
                onClick={saveSignature}
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
