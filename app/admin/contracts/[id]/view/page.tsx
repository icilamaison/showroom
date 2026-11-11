"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiClientError, fetchAdminContractById } from "@/lib/api-client";
import { isPurchaseContractPayload } from "@/lib/order-excel";
import { purchasePayloadToFormValues } from "@/lib/contract-document";
import ContractDocumentViewer from "@/app/contract/ContractDocumentViewer";
import "@/app/contract/contract.css";

// 관리자 전용 계약서 보기: 로그인으로 조회하므로 고객용 링크가 만료·재발급돼도 언제든 열린다
export default function AdminContractViewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const contractId = Number(params.id);
  // 상세 화면과 같은 캐시를 써서 상세 ↔ 보기 이동 시 바로 보여준다
  const detailQuery = useQuery({
    queryKey: ["adminContract", contractId],
    queryFn: () => fetchAdminContractById(contractId),
  });
  const contract = detailQuery.data ?? null;
  const isUnauthorized =
    detailQuery.error instanceof ApiClientError && detailQuery.error.status === 401;
  const error =
    detailQuery.isError && !isUnauthorized ? "계약서를 불러오지 못했습니다." : "";

  useEffect(() => {
    if (isUnauthorized) router.push("/admin/login");
  }, [isUnauthorized, router]);

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
