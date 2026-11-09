import ContractDocumentView, { ContractNoticePage } from "./ContractDocumentView";
import type { ContractFormValues } from "@/lib/validation/contract";

type ContractPdfDocumentProps = {
  values: ContractFormValues;
};

export default function ContractPdfDocument({ values }: ContractPdfDocumentProps) {
  return (
    <div className="contract-doc__pdf-document">
      {/* 작성 화면 순서: 계약서 → 안내문 + 동의·서명 */}
      <div className="contract-doc__pdf-contract-section">
        <ContractDocumentView values={values} hideEmptyRows />
      </div>
      <div className="contract-doc__pdf-notice-section">
        <ContractNoticePage
          values={values}
          noticeClassName="contract-doc contract-doc--document notice-document contract-doc__pdf-notice"
        />
      </div>
    </div>
  );
}
