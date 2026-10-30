type ContractNoticeDocumentProps = {
  className?: string;
};

export default function ContractNoticeDocument({
  className = "contract-doc contract-doc--document notice-document",
}: ContractNoticeDocumentProps) {
  return (
    <article className={className}>
      <header className="contract-doc__header">
        <div className="contract-doc__brand">
          <img
            className="contract-doc__brand-name"
            src="/logo_black.svg"
            alt="이씨라메종"
          />
          <span className="contract-doc__brand-contact">
            쇼룸 070-4149-9149 | 고객센터 02-6949-3223 | icilamaison.com
          </span>
        </div>

        <h1 className="contract-doc__title">배송·교환·반품 등 안내</h1>

        <div className="contract-doc__meta">
          <span className="contract-doc__meta-item contract-doc__meta-item--block">
            본 안내문은 구매계약서의 별첨 문서이며, 계약서 서명 시 안내된 내용과
            동일합니다.&nbsp;&nbsp;|&nbsp;&nbsp;정책 개정일 : 2026. 10
          </span>
        </div>
      </header>

      <section className="contract-doc__section">
        <h2 className="contract-doc__section-title contract-doc__section-title--divider">
          배송 안내
        </h2>
        <ul className="notice-list">
          <li>
            평균 발송 기간은 2-10일(주말, 공휴일 제외) / 주문 제작은 2-3주
            소요됩니다.
            <br />
            주문량이 많거나 상품의 특성에 따라 발송 기간이 다소 소요될 수
            있습니다.
          </li>
        </ul>
      </section>

      <section className="contract-doc__section">
        <h2 className="contract-doc__section-title contract-doc__section-title--divider">
          교환 및 반품 안내
        </h2>

        <h3 className="notice-subtitle">단순 변심 반품</h3>
        <p className="notice-text">
          반품은 수령 후 7일 이내(변심/파손/오염/불량 포함) 이씨라메종
          쇼룸(070-4149-9149)으로 연락해 주시면 처리 도와드리겠습니다.
          <br />
          *이씨라메종은 단순 변심으로 인한 교환 서비스를 제공하고 있지
          않습니다. 교환을 원하실 경우, 기존 상품을 반품하신 후 원하시는
          상품을 새로 주문해 주세요.
        </p>

        <h3 className="notice-subtitle">변심 반품 왕복 배송비</h3>
        <p className="notice-text">
          일반택배 8,000원
          <br />
          화물택배(러그) 1호 : 16,000원 / 2호 : 30,000원
          <br />
          *3호 이상 및 주문 제작 상품 : 반품 불가
        </p>

        <h3 className="notice-subtitle">불량·파손·오염 상품 교환 및 반품</h3>
        <p className="notice-text">
          제품 자체의 결함(불량) 및 배송 과정에서 발생한 파손, 오염이 확인된
          상품은 수령 후 7일 이내 이씨라메종 쇼룸으로 연락해 주시면 처리
          도와드리겠습니다.
          <br />
          구매자의 사용 또는 보관 과정에서 발생한 손상은 교환 및 반품이
          불가합니다.
        </p>

        <h3 className="notice-subtitle">교환 및 반품이 불가한 경우</h3>
        <ol className="notice-list">
          <li>상품 수령 후 7일이 지난 경우</li>
          <li>
            구매자의 사용 또는 과실로 상품이 손상된 경우(세탁, 이염, 냄새,
            미끄럼 방지 패드 부착 등)
          </li>
          <li>
            라벨을 제거한 경우, 이는 사용한 것으로 간주되어 교환·반품이
            불가합니다.
          </li>
          <li>구성품·사은품 반납이 확인되지 않은 경우</li>
          <li>
            주문 제작 상품인 경우(러그 3호 이상 및 주문 제작 사이즈 포함)
          </li>
          <li>사진 접수 없이 임의로 반송하신 경우(재반송 처리)</li>
        </ol>
      </section>

      <section className="contract-doc__section">
        <h2 className="contract-doc__section-title contract-doc__section-title--divider">
          러그 전문 세탁 업체 안내
        </h2>
        <p className="notice-text">
          울 러그를 제외한 모든 러그는 러그 전문 세탁 업체를 통해 [습식 세탁]을,
          울 러그는 [드라이클리닝]을 권장드립니다. (Tel : 010-5495-6706)
        </p>
      </section>

      <p className="notice-footer">
        상담 과정에서 구매하신 상품에 대해 미처 안내드리지 못한 내용이 있을 수
        있습니다.
        <br />
        번거로우시겠지만, 귀가하신 후{" "}
        <a
          href="https://icilamaison.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          이씨라메종 홈페이지
        </a>
        에서 구매하신 상품명을 검색하시어 관리 방법과 사용 시 유의사항 등을
        한 번 더 확인해 주시면 감사하겠습니다. 자세한 내용은{" "}
        <a
          href="https://icilamaison.com/care_guide.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          케어 가이드
        </a>
        에서도 확인하실 수 있습니다.
        <br />
        고객님의 일상 속에서 오래도록 곁을 지키며, 오랜 시간 만족스럽게
        사용하실 수 있는 제품이 되기를 바랍니다.
        <br />
        감사합니다.
      </p>
    </article>
  );
}
