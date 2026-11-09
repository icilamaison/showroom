"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ApiClientError,
  fetchAdminContractById,
  type ContractDetail,
} from "@/lib/api-client";
import { isPurchaseContractPayload } from "@/lib/order-excel";
import { purchasePayloadToFormValues } from "@/lib/contract-document";
import ContractDocumentViewer from "@/app/contract/ContractDocumentViewer";
import "@/app/contract/contract.css";

// 관리자 전용 계약서 보기: 로그인으로 조회하므로 고객용 링크가 만료·재발급돼도 언제든 열린다
export default function AdminContractViewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAdminContractById(Number(params.id))
      .then(setContract)
      .catch((loadError) => {
        if (loadError instanceof ApiClientError && loadError.status === 401) {
          router.push("/admin/login");
          return;
        }

        setError("계약서를 불러오지 못했습니다.");
      });
  }, [params.id, router]);

  const documentValues =
    contract && isPurchaseContractPayload(contract.payload)
      ? purchasePayloadToFormValues(contract.payload)
      : null;

  return (
    <main className="app-page app-page--contract-view">
      <div className="app-container app-container--doc">
        {error ? (
          <p className="app-alert app-alert--error">{error}</p>
        ) : !contract ? (
          <p className="app-description">불러오는 중...</p>
        ) : documentValues ? (
          <ContractDocumentViewer values={documentValues} />
        ) : (
          <p className="app-alert app-alert--error">계약서 내용을 표시할 수 없습니다.</p>
        )}
      </div>
    </main>
  );
}
