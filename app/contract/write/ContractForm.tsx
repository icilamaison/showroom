"use client";

import {
  createEmptyProductRows,
  type ContractFormValues,
  type ProductRow,
} from "@/lib/validation/contract";
import "./../contract.css";

export const emptyContractFormValues: ContractFormValues = {
  managerName: "",
  writtenDateYear: "",
  writtenDateMonth: "",
  writtenDateDay: "",
  buyerName: "",
  buyerPhone: "",
  recipientSameAsBuyer: null,
  recipientName: "",
  recipientPhone: "",
  recipientAddress: "",
  products: createEmptyProductRows(),
  paymentMethod: "",
  cashReceiptType: "",
  cashReceiptPhone: "",
  cashReceiptBusinessNumber: "",
  taxInvoiceRequested: false,
  taxInvoiceEmail: "",
  agreementDateYear: "",
  agreementDateMonth: "",
  agreementDateDay: "",
  signatureName: "",
  termsAgreed: false,
};

export function createInitialContractFormValues(): ContractFormValues {
  const today = new Date();

  return {
    ...emptyContractFormValues,
    writtenDateYear: String(today.getFullYear()),
    writtenDateMonth: String(today.getMonth() + 1),
    writtenDateDay: String(today.getDate()),
  };
}

type ContractFormProps = {
  values: ContractFormValues;
  errors?: Record<string, string>;
  isSubmitting?: boolean;
  onChange: (
    field: keyof ContractFormValues,
    value: string | boolean | null,
  ) => void;
  onProductChange: (
    index: number,
    field: keyof ProductRow,
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

export default function ContractForm({
  values,
  errors = {},
  isSubmitting = false,
  onChange,
  onProductChange,
  onSubmit,
}: ContractFormProps) {
  const isSubmitDisabled = !values.termsAgreed || isSubmitting;
  const showBankTransferFields = values.paymentMethod === "bank_transfer";
  const recipientDisabled = values.recipientSameAsBuyer === true;

  return (
    <form onSubmit={onSubmit} className="contract-doc" noValidate>
      <header className="contract-doc__header">
        <div className="contract-doc__brand">
          <strong className="contract-doc__brand-name">이씨라메종</strong>
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
                  value={values.recipientName}
                  onChange={(event) =>
                    onChange("recipientName", event.target.value)
                  }
                  className="contract-doc__cell-input"
                  disabled={recipientDisabled}
                />
                <FieldError message={errors.recipientName} />
              </td>
              <th scope="row">연락처</th>
              <td>
                <input
                  type="tel"
                  inputMode="tel"
                  value={values.recipientPhone}
                  onChange={(event) =>
                    onChange("recipientPhone", event.target.value)
                  }
                  className="contract-doc__cell-input"
                  disabled={recipientDisabled}
                  placeholder="010-0000-0000"
                />
                <FieldError message={errors.recipientPhone} />
              </td>
            </tr>
            <tr>
              <th scope="row">배송지 주소</th>
              <td colSpan={3}>
                <input
                  type="text"
                  value={values.recipientAddress}
                  onChange={(event) =>
                    onChange("recipientAddress", event.target.value)
                  }
                  className="contract-doc__cell-input contract-doc__cell-input--full"
                  disabled={recipientDisabled}
                />
                <FieldError message={errors.recipientAddress} />
              </td>
            </tr>
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
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            {values.products.map((product, index) => (
              <tr key={index}>
                <td className="contract-doc__row-no">{index + 1}</td>
                <td>
                  <input
                    type="text"
                    value={product.name}
                    onChange={(event) =>
                      onProductChange(index, "name", event.target.value)
                    }
                    className="contract-doc__cell-input"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={product.color}
                    onChange={(event) =>
                      onProductChange(index, "color", event.target.value)
                    }
                    className="contract-doc__cell-input"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={product.size}
                    onChange={(event) =>
                      onProductChange(index, "size", event.target.value)
                    }
                    className="contract-doc__cell-input"
                  />
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
                    value={product.remarks}
                    onChange={(event) =>
                      onProductChange(index, "remarks", event.target.value)
                    }
                    className="contract-doc__cell-input"
                  />
                </td>
              </tr>
            ))}
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
                        disabled={!showBankTransferFields}
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
                    사업자등록증 별도 제출 필수. (세금계산서 수령 이메일 :{" "}
                    <input
                      type="email"
                      value={values.taxInvoiceEmail}
                      onChange={(event) =>
                        onChange("taxInvoiceEmail", event.target.value)
                      }
                      className="contract-doc__inline-input contract-doc__inline-input--email"
                      disabled={!showBankTransferFields}
                      placeholder="email@example.com"
                    />
                    )
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
                className="contract-doc__inline-input contract-doc__inline-input--signature"
              />
              <span>(인)</span>
            </label>
          </div>
          <FieldError message={errors.signatureName} />
        </div>

        <label className="contract-doc__terms">
          <input
            type="checkbox"
            checked={values.termsAgreed}
            onChange={(event) => onChange("termsAgreed", event.target.checked)}
          />
          <span>위 내용을 확인하였으며 동의합니다.</span>
        </label>
        <FieldError message={errors.termsAgreed} />
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

      <button
        type="submit"
        disabled={isSubmitDisabled}
        className="contract-doc__submit"
      >
        {isSubmitting ? "제출 중..." : "계약서 제출"}
      </button>
    </form>
  );
}
