"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ContractCompanyFooter from "../ContractCompanyFooter";
import ContractNoticeDocument from "../ContractNoticeDocument";
import "../../ui.css";
import "../contract.css";

export default function ContractNoticePage() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);

  return (
    <main className="app-page">
      <div className="app-container app-container--doc">
        <Link href="/" className="app-back-link">
          ← 홈으로
        </Link>

        <div className="contract-doc-flow">
          <ContractNoticeDocument className="contract-doc contract-doc--document contract-doc--sheet notice-document" />

          <div className="contract-doc-flow__actions">
            <label className="notice-agree">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
              />
              위 배송·교환·반품 등 안내사항을 모두 확인하였습니다.
            </label>

            <button
              type="button"
              className="app-button app-button--block"
              disabled={!agreed}
              onClick={() => router.push("/contract/write")}
            >
              다음
            </button>

            <ContractCompanyFooter />
          </div>
        </div>
      </div>
    </main>
  );
}
