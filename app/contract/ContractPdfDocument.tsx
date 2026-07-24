import ContractDocumentView from "./ContractDocumentView";
import ContractNoticeDocument from "./ContractNoticeDocument";
import type { ContractFormValues } from "@/lib/validation/contract";

type ContractPdfDocumentProps = {
  values: ContractFormValues;
};

export default function ContractPdfDocument({ values }: ContractPdfDocumentProps) {
  return (
    <div className="contract-doc__pdf-document">
      <div className="contract-doc__pdf-notice-section">
        <ContractNoticeDocument className="contract-doc contract-doc--document notice-document contract-doc__pdf-notice" />
      </div>
      <div className="contract-doc__pdf-contract-section">
        <ContractDocumentView values={values} />
      </div>
    </div>
  );
}
