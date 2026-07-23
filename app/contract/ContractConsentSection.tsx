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

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="contract-doc__error">{message}</p>;
}

type ContractConsentSectionProps = {
  termsAgreed: boolean;
  marketingConsentAgreed: boolean;
  onChange?: (
    field: "termsAgreed" | "marketingConsentAgreed",
    value: boolean,
  ) => void;
  errors?: {
    termsAgreed?: string;
    marketingConsentAgreed?: string;
  };
};

export function ContractConsentSection({
  termsAgreed,
  marketingConsentAgreed,
  onChange,
  errors = {},
}: ContractConsentSectionProps) {
  const readonly = !onChange;

  return (
    <div className="contract-doc__consent">
      <p className="contract-doc__consent-heading">필수 동의 (계약 및 배송)</p>

      <div className="contract-doc__consent-item">
        {readonly ? (
          <DocCheckboxDisplay
            checked={termsAgreed}
            label="개인정보 수집·이용에 동의합니다."
          />
        ) : (
          <DocCheckbox
            name="termsAgreed"
            checked={termsAgreed}
            onChange={() => onChange("termsAgreed", !termsAgreed)}
            label="개인정보 수집·이용에 동의합니다."
          />
        )}
        <details className="contract-doc__consent-details">
          <summary className="contract-doc__consent-summary">자세히 보기</summary>
          <p className="contract-doc__consent-detail">
            본인은 개인정보 수집·이용 안내를 확인하였으며, 상품 구매계약의 체결, 결제,
            배송, A/S 및 고객 문의 응대, 관계 법령에 따른 보관을 위한 개인정보
            수집·이용에 동의합니다.
            <span className="contract-doc__consent-note">
              (※ 이 항목은 계약을 위해 필요한 필수 동의입니다.)
            </span>
          </p>
        </details>
        <FieldError message={errors.termsAgreed} />
      </div>

      <p className="contract-doc__consent-heading">선택 동의 (마케팅)</p>

      <div className="contract-doc__consent-item">
        {readonly ? (
          <DocCheckboxDisplay
            checked={marketingConsentAgreed}
            label="마케팅 정보 수신 및 개인정보 활용에 동의합니다. (선택)"
          />
        ) : (
          <DocCheckbox
            name="marketingConsentAgreed"
            checked={marketingConsentAgreed}
            onChange={() =>
              onChange("marketingConsentAgreed", !marketingConsentAgreed)
            }
            label="마케팅 정보 수신 및 개인정보 활용에 동의합니다. (선택)"
          />
        )}
        <details className="contract-doc__consent-details">
          <summary className="contract-doc__consent-summary">자세히 보기</summary>
          <p className="contract-doc__consent-detail">
            본인은 이벤트, 신상품, 프로모션, 할인 혜택 등의 마케팅 정보를
            문자메시지(SMS), 카카오 알림톡·채널 등을 통해 제공받는 것에 동의합니다.
          </p>
        </details>
        <p className="contract-doc__consent-footnote">
          ※ 동의하지 않아도 상품 구매 및 서비스 이용에는 제한이 없습니다.
        </p>
      </div>
    </div>
  );
}
