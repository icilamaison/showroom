import Link from "next/link";

type ContractCompletePageProps = {
  searchParams: Promise<{
    contractNumber?: string;
    viewToken?: string;
  }>;
};

export default async function ContractCompletePage({
  searchParams,
}: ContractCompletePageProps) {
  const { contractNumber, viewToken } = await searchParams;

  return (
    <main className="app-page app-page--center">
      <div className="app-container app-container--narrow app-panel">
        <header className="app-header">
          <img
            className="app-brand"
            src="https://icilamaison.com/26renewer/resource/image/logo_black.svg"
            alt="이씨라메종"
          />
          <h1 className="app-title">제출 완료</h1>
          <p className="app-description">계약서가 정상적으로 접수되었습니다.</p>
        </header>

        {contractNumber ? (
          <div className="app-complete-box">
            <p className="app-complete-box__label">발급된 계약번호</p>
            <p className="app-complete-box__value">{contractNumber}</p>
            {viewToken ? (
              <Link
                href={`/contract/view/${encodeURIComponent(contractNumber)}?token=${encodeURIComponent(viewToken)}`}
                className="app-menu__item"
              >
                계약서 웹으로 보기
              </Link>
            ) : null}
          </div>
        ) : (
          <p className="app-alert app-alert--error">
            계약번호를 확인할 수 없습니다. 고객센터로 문의해주세요.
          </p>
        )}

        <Link href="/" className="app-menu__item">
          홈으로 돌아가기
        </Link>
      </div>
    </main>
  );
}
