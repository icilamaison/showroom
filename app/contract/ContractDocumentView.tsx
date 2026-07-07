"use client";

import { Fragment } from "react";
import Image from "next/image";
import {
  findCatalogProductByName,
  isSetProduct,
  type CatalogProduct,
} from "@/lib/product-catalog";
import {
  buildSetSelectionsFromColor,
  type SetComponentSelection,
} from "@/lib/set-product";
import type { ContractFormValues, ProductRow } from "@/lib/validation/contract";
import "./contract.css";

function ReadonlyValue({
  value,
  className = "contract-doc__cell-input",
  align = "left",
}: {
  value: string;
  className?: string;
  align?: "left" | "center";
}) {
  return (
    <span
      className={`${className} contract-doc__readonly-value${
        align === "center" ? " contract-doc__readonly-value--center" : ""
      }`}
    >
      {value}
    </span>
  );
}

function DateDisplay({
  year,
  month,
  day,
}: {
  year: string;
  month: string;
  day: string;
}) {
  return (
    <span className="contract-doc__date-group">
      <span className="contract-doc__date-input contract-doc__date-input--year contract-doc__readonly-value">
        {year}
      </span>
      <span>년</span>
      <span className="contract-doc__date-input contract-doc__date-input--md contract-doc__readonly-value">
        {month}
      </span>
      <span>월</span>
      <span className="contract-doc__date-input contract-doc__date-input--md contract-doc__readonly-value">
        {day}
      </span>
      <span>일</span>
    </span>
  );
}

function DocCheckboxDisplay({
  checked,
  label,
}: {
  checked: boolean;
  label: React.ReactNode;
}) {
  return (
    <span className="contract-doc__checkbox contract-doc__checkbox--readonly">
      <span className="contract-doc__checkbox-box" aria-hidden="true">
        [{checked ? "✓" : " "}]
      </span>
      <span>{label}</span>
    </span>
  );
}

function SetProductDocumentComponents({
  rowIndex,
  components,
  selections,
}: {
  rowIndex: number;
  components: CatalogProduct["components"];
  selections: SetComponentSelection[];
}) {
  if (!components?.length) {
    return null;
  }

  return (
    <>
      {components.map((component, componentIndex) => {
        const selection = selections[componentIndex] ?? { color: "", size: "" };
        const colorOptions = component.colors ?? [];
        const sizeOptions = component.sizes ?? [];

        return (
          <tr
            key={`${rowIndex}-component-${componentIndex}`}
            className="contract-doc__set-component-row"
          >
            <td />
            <td className="contract-doc__set-component-name">{component.name}</td>
            <td>
              {colorOptions.length > 0 ? (
                <span className="contract-doc__set-component-value">
                  {selection.color || colorOptions[0]}
                </span>
              ) : null}
            </td>
            <td>
              {sizeOptions.length > 0 ? (
                <span className="contract-doc__set-component-value">
                  {selection.size || sizeOptions[0]}
                </span>
              ) : null}
            </td>
            <td colSpan={2} />
          </tr>
        );
      })}
    </>
  );
}

function resolveProductRow(product: ProductRow): {
  catalogProduct: CatalogProduct | null;
  isSet: boolean;
  setSelections: SetComponentSelection[];
} {
  const catalogProduct = findCatalogProductByName(product.name);
  const isSet =
    Boolean(catalogProduct && isSetProduct(catalogProduct)) ||
    product.color.trim().startsWith("COLOR=");

  const setSelections =
    catalogProduct?.components && isSet
      ? buildSetSelectionsFromColor(catalogProduct.components, product.color)
      : [];

  return {
    catalogProduct,
    isSet,
    setSelections,
  };
}

type ContractDocumentViewProps = {
  values: ContractFormValues;
  className?: string;
};

export default function ContractDocumentView({
  values,
  className = "",
}: ContractDocumentViewProps) {
  const displayedRecipientName = values.recipientSameAsBuyer
    ? values.buyerName
    : values.recipientName;
  const displayedRecipientPhone = values.recipientSameAsBuyer
    ? values.buyerPhone
    : values.recipientPhone;

  return (
    <article className={`contract-doc contract-doc--document ${className}`.trim()}>
      <header className="contract-doc__header">
        <div className="contract-doc__brand">
          <strong className="contract-doc__brand-name">이씨라메종</strong>
          <span className="contract-doc__brand-contact">
            쇼룸 070-4149-9149 | 고객센터 02-6949-3223 | icilamaison.com
          </span>
        </div>

        <h1 className="contract-doc__title">구매 계약서 (거래명세서)</h1>

        <div className="contract-doc__meta">
          <div className="contract-doc__meta-item">
            <span>담당자 :</span>
            <ReadonlyValue
              value={values.managerName}
              className="contract-doc__inline-input"
            />
          </div>
          <div className="contract-doc__meta-item">
            <span>작성일자 :</span>
            <DateDisplay
              year={values.writtenDateYear}
              month={values.writtenDateMonth}
              day={values.writtenDateDay}
            />
          </div>
        </div>
      </header>

      <section className="contract-doc__section">
        <h2 className="contract-doc__section-title">구매자 정보</h2>
        <table className="contract-doc__table">
          <tbody>
            <tr>
              <th scope="row">성명</th>
              <td>
                <ReadonlyValue value={values.buyerName} />
              </td>
              <th scope="row">연락처</th>
              <td>
                <ReadonlyValue value={values.buyerPhone} />
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="contract-doc__section">
        <div className="contract-doc__section-heading">
          <h2 className="contract-doc__section-title">수령자 정보 :</h2>
          <div className="contract-doc__option-group">
            <DocCheckboxDisplay
              checked={values.recipientSameAsBuyer === true}
              label="구매자와 동일"
            />
            <DocCheckboxDisplay
              checked={values.recipientSameAsBuyer === false}
              label="아래에 별도 입력"
            />
          </div>
        </div>

        <table className="contract-doc__table">
          <tbody>
            <tr>
              <th scope="row">성명</th>
              <td>
                <ReadonlyValue value={displayedRecipientName} />
              </td>
              <th scope="row">연락처</th>
              <td>
                <ReadonlyValue value={displayedRecipientPhone} />
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="contract-doc__section">
        <h2 className="contract-doc__section-title">배송지 정보</h2>
        <table className="contract-doc__table">
          <tbody>
            <tr>
              <th scope="row">배송지 주소</th>
              <td colSpan={3}>
                <div className="contract-doc__address-readonly">
                  <ReadonlyValue
                    value={values.recipientPostalCode}
                    className="contract-doc__cell-input contract-doc__cell-input--postal"
                  />
                  <ReadonlyValue
                    value={values.recipientAddress}
                    className="contract-doc__cell-input contract-doc__cell-input--full"
                  />
                </div>
                {values.recipientAddressDetail ? (
                  <ReadonlyValue
                    value={values.recipientAddressDetail}
                    className="contract-doc__cell-input contract-doc__cell-input--full"
                  />
                ) : null}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="contract-doc__section">
        <h2 className="contract-doc__section-title">상품 정보</h2>
        <table className="contract-doc__table contract-doc__table--products">
          <thead>
            <tr>
              <th>No</th>
              <th>제품명</th>
              <th>컬러</th>
              <th>사이즈</th>
              <th>수량</th>
              <th>금액</th>
            </tr>
          </thead>
          <tbody>
            {values.products.map((product, index) => {
              const { catalogProduct, isSet, setSelections } =
                resolveProductRow(product);

              return (
                <Fragment key={index}>
                  <tr>
                    <td className="contract-doc__row-no">{index + 1}</td>
                    <td>
                      <ReadonlyValue value={product.name} />
                    </td>
                    <td>
                      {isSet ? (
                        <span className="contract-doc__set-option-name">
                          {product.color || "-"}
                        </span>
                      ) : (
                        <ReadonlyValue value={product.color} />
                      )}
                    </td>
                    <td>
                      {isSet ? null : <ReadonlyValue value={product.size} />}
                    </td>
                    <td>
                      <ReadonlyValue
                        value={product.quantity}
                        align="center"
                        className="contract-doc__cell-input contract-doc__cell-input--qty"
                      />
                    </td>
                    <td>
                      <ReadonlyValue
                        value={product.unitPrice}
                        align="center"
                        className="contract-doc__cell-input contract-doc__cell-input--qty"
                      />
                    </td>
                  </tr>
                  {isSet && catalogProduct?.components ? (
                    <SetProductDocumentComponents
                      rowIndex={index}
                      components={catalogProduct.components}
                      selections={setSelections}
                    />
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="contract-doc__section">
        <h2 className="contract-doc__section-title">결제 정보</h2>
        <table className="contract-doc__table contract-doc__table--payment">
          <tbody>
            <tr>
              <th scope="row">결제수단</th>
              <td colSpan={3}>
                <div className="contract-doc__option-group">
                  <DocCheckboxDisplay
                    checked={values.paymentMethod === "card"}
                    label="카드"
                  />
                  <DocCheckboxDisplay
                    checked={values.paymentMethod === "bank_transfer"}
                    label={
                      <>
                        계좌이체{" "}
                        <span className="contract-doc__muted">
                          (신한은행 140-014-980017 / 예금주 : 홈온얼스(주))
                        </span>
                      </>
                    }
                  />
                </div>
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
                  <DocCheckboxDisplay
                    checked={values.cashReceiptType === "income_deduction"}
                    label={
                      <>
                        소득공제용(휴대폰번호{" "}
                        <ReadonlyValue
                          value={values.cashReceiptPhone}
                          className="contract-doc__inline-input contract-doc__inline-input--phone"
                        />
                        )
                      </>
                    }
                  />
                  <DocCheckboxDisplay
                    checked={values.cashReceiptType === "expense_proof"}
                    label={
                      <>
                        지출증빙용(사업자등록번호 :{" "}
                        <ReadonlyValue
                          value={values.cashReceiptBusinessNumber}
                          className="contract-doc__inline-input contract-doc__inline-input--biz"
                        />
                        )
                      </>
                    }
                  />
                </div>
              </td>
            </tr>
            <tr>
              <th scope="row">세금계산서 발행</th>
              <td colSpan={2}>
                <DocCheckboxDisplay
                  checked={values.taxInvoiceRequested}
                  label={
                    <>
                      사업자등록증 별도 제출 필수. (세금계산서 수령 이메일 :{" "}
                      <ReadonlyValue
                        value={values.taxInvoiceEmail}
                        className="contract-doc__inline-input contract-doc__inline-input--email"
                      />
                      )
                    </>
                  }
                />
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

          <div className="contract-doc__agreement-sign">
            <DateDisplay
              year={values.agreementDateYear}
              month={values.agreementDateMonth}
              day={values.agreementDateDay}
            />
            <span className="contract-doc__signature">
              <span>구매자 :</span>
              <span className="contract-doc__signature-buyer-name">
                {values.buyerName || values.signatureName}
              </span>
              <span className="contract-doc__signature-stamp-wrap">
                {values.signatureDataUrl ? (
                  <Image
                    src={values.signatureDataUrl}
                    alt="구매자 서명"
                    className="contract-doc__signature-stamp-image"
                    width={70}
                    height={28}
                    unoptimized
                  />
                ) : null}
                <span className="contract-doc__signature-stamp-text">(인)</span>
              </span>
            </span>
          </div>
        </div>

        <label className="contract-doc__terms contract-doc__terms--readonly">
          <span className="contract-doc__checkbox-box" aria-hidden="true">
            [{values.termsAgreed ? "✓" : " "}]
          </span>
          <span>위 내용을 확인하였으며 동의합니다.</span>
        </label>
      </section>

      <footer className="contract-doc__footer">
        <p className="contract-doc__footer-note">
          본 문서는 동일한 내용으로 2부 작성되며, 1부는 구매자 보관용, 1부는
          매장(판매자) 보관용입니다. © 이씨라메종
        </p>
        <div className="contract-doc__footer-company">
          <p>
            이씨라메종 (홈온얼스 주식회사) | 사업자등록번호 772-86-01622 | 쇼룸
            070-4149-9149
          </p>
          <p>
            서울 강서구 마곡중앙6로 21, 8층 811-815호 (마곡동, 이너매스마곡 1)
          </p>
        </div>
      </footer>
    </article>
  );
}
