import Link from "next/link";

export default function HomePage() {
  return (
    <main className="app-page app-page--center">
      <div className="app-container app-container--narrow app-panel">
        <header className="app-header">
          <strong className="app-brand">이씨라메종</strong>
          <h1 className="app-title">계약서 작성 시스템</h1>
        </header>

        <nav className="app-menu">
          <Link href="/contract/write" className="app-menu__item">
            계약서 작성
          </Link>
          <Link href="/admin/login" className="app-menu__item">
            관리자 로그인
          </Link>
        </nav>
      </div>
    </main>
  );
}
