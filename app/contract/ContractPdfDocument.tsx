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
        {values.noticeAnnotationImage ? (
          <img
            className="notice-annotation-image"
            src={values.noticeAnnotationImage}
            alt="펜으로 표시한 배송·교환·반품 등 안내"
          />
        ) : (
          <ContractNoticeDocument className="contract-doc contract-doc--document notice-document contract-doc__pdf-notice" />
        )}
      </div>
      <div className="contract-doc__pdf-contract-section">
        <ContractDocumentView values={values} />
      </div>
    </div>
  );
}
