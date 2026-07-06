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
      router.push("/admin/contracts");
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
    <main className="admin-page">
      <div className="admin-card">
        <h1 className="admin-card__title">관리자 로그인</h1>
        <p className="admin-card__description">
          계약서 관리 페이지에 접근하려면 로그인해주세요.
        </p>

        <form className="admin-form" onSubmit={handleSubmit}>
          {error ? <p className="admin-form__error">{error}</p> : null}

          <div className="admin-form__field">
            <label htmlFor="username" className="admin-form__label">
              아이디
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="admin-form__input"
              required
            />
          </div>

          <div className="admin-form__field">
            <label htmlFor="password" className="admin-form__label">
              비밀번호
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="admin-form__input"
              required
            />
          </div>

          <button
            type="submit"
            className="admin-form__submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </main>
  );
}
