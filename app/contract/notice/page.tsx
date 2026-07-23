"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ContractCompanyFooter from "../ContractCompanyFooter";
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
          <article className="contract-doc contract-doc--document contract-doc--sheet notice-document">
            <header className="contract-doc__header">
              <div className="contract-doc__brand">
                <img
                  className="contract-doc__brand-name"
                  src="https://icilamaison.com/26renewer/resource/image/logo_black.svg"
                  alt="이씨라메종"
                />
                <span className="contract-doc__brand-contact">
                  쇼룸 070-4149-9149 | 고객센터 02-6949-3223 | icilamaison.com
                </span>
              </div>

              <h1 className="contract-doc__title">배송·교환·반품 등 안내</h1>

              <div className="contract-doc__meta">
                <span className="contract-doc__meta-item contract-doc__meta-item--block">
                  본 안내문은 구매계약서의 별첨 문서이며, 계약서 서명 시 안내된 내용과 동일합니다.&nbsp;&nbsp;|&nbsp;&nbsp;정책 개정일 : 2026. 06
                </span>
              </div>
            </header>

            <section className="contract-doc__section">
              <h2 className="contract-doc__section-title contract-doc__section-title--divider">
                배송 안내
              </h2>
              <ul className="notice-list">
                <li>
                  평균 발송 기간은 2-10일(주말, 공휴일 제외) 소요됩니다.
                  주문량이 많거나 상품의 특성(주문 제작 등)에 따라 발송
                  기간이 다소 소요될 수 있습니다.
                </li>
                <li>
                  커튼 주문제작의 경우 실측 출장 및 시공 일정 관련하여
                  기사님께서 해피콜 드릴 예정입니다.
                </li>
              </ul>
            </section>

            <section className="contract-doc__section">
              <h2 className="contract-doc__section-title contract-doc__section-title--divider">
                교환 및 반품 안내
              </h2>

              <h3 className="notice-subtitle">단순 변심 교환 및 반품</h3>
              <p className="notice-text">
                제품의 하자가 아닌 구매자 변심에 의한 반품 시 왕복 운반비용을
                청구합니다. 3호 이상 및 주문제작 상품은 교환·반품 불가합니다.
              </p>

              <h3 className="notice-subtitle">
                불량·파손·오염 상품 교환 및 반품
              </h3>
              <p className="notice-text">
                제품 자체의 결함(불량) 및 배송 과정에서 발생한 파손, 오염이
                확인된 상품은 수령 후 7일 이내 이씨라메종 쇼룸으로 연락
                주시면 처리 도와드리겠습니다.
                <br />
                구매자의 사용 또는 보관 과정에서 발생한 손상은 교환 및
                반품이 불가합니다.
              </p>

              <h3 className="notice-subtitle">교환 및 반품이 불가한 경우</h3>
              <ol className="notice-list">
                <li>상품 수령 후 7일이 지난 경우</li>
                <li>
                  구매자의 사용 또는 과실로 상품이 손상된 경우 (세탁, 이염,
                  냄새, 미끄럼방지 패드 부착 등)
                </li>
                <li>
                  라벨을 제거한 경우, 이는 사용한 것으로 간주되어
                  교환·반품이 불가합니다.
                </li>
                <li>구성품·사은품 반납이 확인되지 않은 경우</li>
                <li>
                  주문제작 상품인 경우 (러그 3호 이상 및 주문제작 사이즈
                  포함)
                </li>
                <li>사진 접수 없이 임의로 반송하신 경우 (재반송 처리)</li>
              </ol>
            </section>

            <section className="contract-doc__section">
              <h2 className="contract-doc__section-title contract-doc__section-title--divider">
                러그 전문 세탁 업체 안내
              </h2>
              <p className="notice-text">
                워셔블 러그를 제외한 모든 러그는 러그 전문 세탁 업체를 통해
                [습식세탁] 권장드립니다. (Tel : 010-5495-6706)
              </p>
            </section>

            <section className="contract-doc__section">
              <h2 className="contract-doc__section-title contract-doc__section-title--divider">
                커튼 교환 및 반품 안내
              </h2>
              <p className="notice-text">
                이씨라메종의 커튼은 실측한 사이즈를 기준으로 제작되는
                주문제작 상품으로, 제작 진행 후에는 교환 및 반품이
                불가합니다.
              </p>
            </section>

            <p className="notice-footer">
              보다 자세한 사용 및 관리 방법은{" "}
              <a
                href="https://icilamaison.com/care_guide.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                케어 가이드
              </a>
              에서 확인하실 수 있습니다. 제품별 안내가 필요한 경우{" "}
              <a
                href="https://icilamaison.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                이씨라메종 홈페이지
              </a>
              에서 구매하신 상품명을 검색해 주세요. 고객님의 공간에서 오래도록
              좋은 쓰임이 되기를 바랍니다.
            </p>
          </article>

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
