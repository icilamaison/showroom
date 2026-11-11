"use client";

import ContractDocumentView, { ContractNoticePage } from "./ContractDocumentView";
import type { ContractFormValues } from "@/lib/validation/contract";

type ContractDocumentViewerProps = {
  values: ContractFormValues;
};

// 계약서 조회 — 모바일 전용 페이지 넘김 없이 PDF처럼 계약서·안내문을 세로로 이어서 보여준다
export default function ContractDocumentViewer({
  values,
}: ContractDocumentViewerProps) {
  return (
    <div className="contract-doc-viewer">
      <section aria-label="구매 계약서">
        <ContractDocumentView values={values} className="contract-doc--sheet" />
      </section>
      <section aria-label="배송·교환·반품 등 안내">
        {/* 작성 화면과 같이 안내문(작성 때 펜 표시 포함) 아래에 동의·서명 */}
        <ContractNoticePage values={values} />
      </section>
    </div>
  );
}
