"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  ApiClientError,
  fetchPublicContract,
  type ContractDetail,
} from "@/lib/api-client";
import { isPurchaseContractPayload } from "@/lib/order-excel";
import {
  buildContractPdfFilename,
  purchasePayloadToFormValues,
} from "@/lib/contract-document";
import { exportContractDocumentToPdf } from "@/lib/contract-pdf-export";
import ContractDocumentView from "@/app/contract/ContractDocumentView";
import "../../contract.css";

export default function ContractViewPage() {
  const params = useParams<{ contractNumber: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const documentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      setError("유효하지 않은 링크입니다.");
      return;
    }

    async function loadContract() {
      setIsLoading(true);
      setError("");

      try {
        const result = await fetchPublicContract(params.contractNumber, token);
        setContract(result);
      } catch (loadError) {
        if (loadError instanceof ApiClientError && loadError.status === 404) {
          setError("계약서를 찾을 수 없습니다. 링크를 다시 확인해주세요.");
        } else {
          setError("계약서를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadContract();
  }, [params.contractNumber, token]);

  const purchasePayload =
    contract && isPurchaseContractPayload(contract.payload)
      ? contract.payload
      : null;
  const documentValues = purchasePayload
    ? purchasePayloadToFormValues(purchasePayload)
    : null;

  return (
    <main className="app-page">
      <div className="app-container app-container--doc">
        {isLoading ? (
          <p className="app-description">불러오는 중...</p>
        ) : error ? (
          <p className="app-alert app-alert--error">{error}</p>
        ) : documentValues ? (
          <>
            <div className="app-panel">
              <div ref={documentRef}>
                <ContractDocumentView values={documentValues} />
              </div>
            </div>

            <div className="app-menu" style={{ marginTop: "1rem" }}>
              <button
                type="button"
                className="app-button"
                disabled={isDownloadingPdf}
                onClick={() => {
                  if (!contract || !documentRef.current) {
                    return;
                  }

                  void (async () => {
                    setIsDownloadingPdf(true);
                    setError("");

                    try {
                      await exportContractDocumentToPdf(
                        documentRef.current as HTMLElement,
                        buildContractPdfFilename(contract.contractNumber),
                      );
                    } catch {
                      setError("PDF 다운로드에 실패했습니다.");
                    } finally {
                      setIsDownloadingPdf(false);
                    }
                  })();
                }}
              >
                {isDownloadingPdf ? "다운로드 중..." : "계약서 PDF 다운로드"}
              </button>
            </div>
          </>
        ) : (
          <p className="app-alert app-alert--error">
            계약서 내용을 표시할 수 없습니다.
          </p>
        )}
      </div>
    </main>
  );
}
