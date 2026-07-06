import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: "2rem" }}>
      <h1>계약서 작성 시스템</h1>
      <ul>
        <li>
          <Link href="/contract/write">계약서 작성</Link>
        </li>
        <li>
          <Link href="/admin/login">관리자 로그인</Link>
        </li>
      </ul>
    </main>
  );
}
