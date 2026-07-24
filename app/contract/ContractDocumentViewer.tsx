"use client";

import { useCallback, useRef, useState } from "react";
import ContractDocumentView from "./ContractDocumentView";
import ContractNoticeDocument from "./ContractNoticeDocument";
import type { ContractFormValues } from "@/lib/validation/contract";

type ContractDocumentViewerProps = {
  values: ContractFormValues;
};

const DOCUMENT_PAGES = [
  {
    key: "notice",
    title: "배송·교환·반품 등 안내",
  },
  {
    key: "contract",
    title: "구매 계약서",
  },
] as const;

const SWIPE_THRESHOLD_PX = 48;

export default function ContractDocumentViewer({
  values,
}: ContractDocumentViewerProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);
  const lastPageIndex = DOCUMENT_PAGES.length - 1;

  const goToPage = useCallback(
    (nextIndex: number) => {
      setPageIndex(Math.min(Math.max(nextIndex, 0), lastPageIndex));
    },
    [lastPageIndex],
  );

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const startX = touchStartXRef.current;
    const endX = event.changedTouches[0]?.clientX;

    touchStartXRef.current = null;

    if (startX == null || endX == null) {
      return;
    }

    const deltaX = endX - startX;

    if (deltaX <= -SWIPE_THRESHOLD_PX) {
      goToPage(pageIndex + 1);
      return;
    }

    if (deltaX >= SWIPE_THRESHOLD_PX) {
      goToPage(pageIndex - 1);
    }
  };

  const currentPage = DOCUMENT_PAGES[pageIndex];

  const renderPageContent = (pageKey: (typeof DOCUMENT_PAGES)[number]["key"]) => {
    if (pageKey === "notice") {
      return (
        <ContractNoticeDocument className="contract-doc contract-doc--document contract-doc--sheet notice-document" />
      );
    }

    return (
      <ContractDocumentView values={values} className="contract-doc--sheet" />
    );
  };

  return (
    <div className="contract-doc-viewer">
      <div className="contract-doc-viewer__toolbar" aria-live="polite">
        <p className="contract-doc-viewer__title">{currentPage.title}</p>
        <p className="contract-doc-viewer__counter">
          {pageIndex + 1} / {DOCUMENT_PAGES.length}
        </p>
      </div>

      <div
        className="contract-doc-viewer__viewport"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="contract-doc-viewer__track"
          style={{ transform: `translateX(-${pageIndex * 100}%)` }}
        >
          {DOCUMENT_PAGES.map((page) => (
            <section
              key={page.key}
              className="contract-doc-viewer__page"
              aria-label={page.title}
              aria-hidden={page.key !== currentPage.key}
            >
              {renderPageContent(page.key)}
            </section>
          ))}
        </div>
      </div>

      <div className="contract-doc-viewer__dots" aria-hidden="true">
        {DOCUMENT_PAGES.map((page, index) => (
          <span
            key={page.key}
            className={`contract-doc-viewer__dot${
              index === pageIndex ? " contract-doc-viewer__dot--active" : ""
            }`}
          />
        ))}
      </div>

      <div className="contract-doc-viewer__nav">
        <button
          type="button"
          className="contract-doc-viewer__nav-button"
          disabled={pageIndex === 0}
          onClick={() => goToPage(pageIndex - 1)}
        >
          이전
        </button>
        <button
          type="button"
          className="contract-doc-viewer__nav-button contract-doc-viewer__nav-button--primary"
          disabled={pageIndex === lastPageIndex}
          onClick={() => goToPage(pageIndex + 1)}
        >
          다음
        </button>
      </div>
    </div>
  );
}
