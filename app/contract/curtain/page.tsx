import Link from "next/link";
import CurtainOrderTable from "./CurtainOrderTable";
import "../../ui.css";

export default function CurtainOrderPage() {
  return (
    <main className="app-page">
      <div className="app-container app-container--doc">
        <Link href="/" className="app-back-link">
          ← 홈으로
        </Link>

        <div className="contract-doc-flow">
          <CurtainOrderTable />
        </div>
      </div>
    </main>
  );
}
