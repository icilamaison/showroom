"use client";

import { logoutAdmin } from "@/lib/api-client";
import Link from "next/link";

export default function HomePage() {
  async function handleLogout() {
    await logoutAdmin();
    window.location.assign("/");
  }

  return (
    <main className="app-page app-page--center">
      <button
        type="button"
        className="app-page__logout"
        onClick={handleLogout}
      >
        로그아웃
      </button>

      <div className="app-container app-container--narrow app-panel">
        <header className="app-header">
          <img
            className="app-brand"
            src="https://icilamaison.com/26renewer/resource/image/logo_black.svg"
            alt="이씨라메종"
          />
          <h1 className="app-title">계약서 작성 시스템</h1>
        </header>

        <nav className="app-menu">
          <Link href="/contract/write" className="app-menu__item">
            러그 계약서 작성
          </Link>
          {/* 커튼 주문서는 준비 중이라 메뉴에서 가린다. 페이지(/contract/curtain)는 그대로 둔다
          <Link href="/contract/curtain" className="app-menu__item">
            커튼 주문서 작성(테스트)
          </Link>
          */}
          <Link href="/admin/contracts" className="app-menu__item">
            계약서 조회
          </Link>
        </nav>
      </div>
    </main>
  );
}
