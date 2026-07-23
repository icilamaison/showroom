export function ContractCompanyFooterContent() {
  return (
    <div className="contract-doc__footer-company">
      <p>
        이씨라메종 (홈온얼스 주식회사) | 사업자등록번호 772-86-01622 | 쇼룸
        070-4149-9149
      </p>
      <p>
        서울 강서구 마곡중앙6로 21, 8층 811-815호 (마곡동, 이너매스마곡 1)
      </p>
    </div>
  );
}

export default function ContractCompanyFooter() {
  return (
    <footer className="contract-doc__footer">
      <ContractCompanyFooterContent />
    </footer>
  );
}
