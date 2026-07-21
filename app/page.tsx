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
          <strong className="app-brand">이씨라메종</strong>
          <h1 className="app-title">계약서 작성 시스템</h1>
        </header>

        <nav className="app-menu">
          <Link href="/contract/write" className="app-menu__item">
            계약서 작성
          </Link>
          <Link href="/admin/contracts" className="app-menu__item">
            계약서 조회
          </Link>
        </nav>
      </div>
    </main>
  );
}
