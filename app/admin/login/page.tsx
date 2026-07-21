"use client";

import { ApiClientError, loginAdmin } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import "../admin.css";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await loginAdmin(username, password);
      const redirectParam = new URLSearchParams(window.location.search).get(
        "redirect",
      );
      const redirectTo =
        redirectParam && redirectParam.startsWith("/")
          ? redirectParam
          : "/admin/contracts";
      router.push(redirectTo);
    } catch (loginError) {
      if (loginError instanceof ApiClientError) {
        setError(loginError.message);
      } else {
        setError("로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="app-page app-page--center">
      <div className="app-container app-container--narrow app-panel">
        <header className="app-header">
          <strong className="app-brand">이씨라메종</strong>
          <h1 className="app-title">관리자 로그인</h1>
        </header>

        <form className="app-form" onSubmit={handleSubmit}>
          {error ? <p className="app-alert app-alert--error">{error}</p> : null}

          <div className="app-field">
            <label htmlFor="username" className="app-label">
              아이디
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="app-input"
              required
            />
          </div>

          <div className="app-field">
            <label htmlFor="password" className="app-label">
              비밀번호
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="app-input"
              required
            />
          </div>

          <button
            type="submit"
            className="app-button app-button--block"
            disabled={isSubmitting}
          >
            {isSubmitting ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </main>
  );
}
