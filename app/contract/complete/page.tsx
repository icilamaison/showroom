import Link from "next/link";

type ContractCompletePageProps = {
  searchParams: Promise<{
    contractNumber?: string;
  }>;
};

export default async function ContractCompletePage({
  searchParams,
}: ContractCompletePageProps) {
  const { contractNumber } = await searchParams;

  return (
    <main style={styles.main}>
      <div style={styles.container}>
        <h1 style={styles.title}>제출이 완료되었습니다</h1>
        <p style={styles.description}>
          계약서가 정상적으로 접수되었습니다.
        </p>

        {contractNumber ? (
          <div style={styles.contractBox}>
            <p style={styles.contractLabel}>발급된 계약번호</p>
            <p style={styles.contractNumber}>{contractNumber}</p>
            <p style={styles.notice}>계약번호를 보관해주세요.</p>
          </div>
        ) : (
          <p style={styles.warning}>
            계약번호를 확인할 수 없습니다. 고객센터로 문의해주세요.
          </p>
        )}

        <Link href="/contract/write" style={styles.link}>
          새 계약서 작성하기
        </Link>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    padding: "2rem 1rem",
  },
  container: {
    maxWidth: "560px",
    margin: "0 auto",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "2rem 1.5rem",
    textAlign: "center",
  },
  title: {
    margin: "0 0 0.75rem",
    fontSize: "1.75rem",
  },
  description: {
    margin: "0 0 1.5rem",
    color: "#4b5563",
  },
  contractBox: {
    padding: "1.25rem",
    borderRadius: "10px",
    background: "#f0f9ff",
    border: "1px solid #bae6fd",
    marginBottom: "1.5rem",
  },
  contractLabel: {
    margin: "0 0 0.5rem",
    fontSize: "0.95rem",
    color: "#0369a1",
    fontWeight: 600,
  },
  contractNumber: {
    margin: "0 0 0.75rem",
    fontSize: "1.5rem",
    fontWeight: 700,
    letterSpacing: "0.02em",
  },
  notice: {
    margin: 0,
    color: "#0f172a",
    fontSize: "0.95rem",
  },
  warning: {
    margin: "0 0 1.5rem",
    color: "#b45309",
  },
  link: {
    display: "inline-block",
    textDecoration: "none",
    fontWeight: 600,
  },
};
