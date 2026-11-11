import type { Viewport } from "next";

// 고객 계약서 보기는 모바일 전용 레이아웃 없이 PDF처럼 문서 전체를 화면 폭에 맞춰 축소해서 보여준다.
// 860 = --doc-width (contract-pdf-export.ts PDF_RENDER_WIDTH_PX와 동일)
export const viewport: Viewport = {
  width: 860,
  initialScale: undefined, // Next 기본값 initial-scale=1이 붙으면 축소되지 않고 확대된 채로 열린다
};

export default function ContractViewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
