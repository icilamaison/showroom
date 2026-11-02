import { describe, expect, it } from "vitest";
import { buildContractPdfFilename, purchasePayloadToFormValues } from "./contract-document";
import type { PurchaseContractPayload } from "./validation/contract";

describe("buildContractPdfFilename", () => {
  it("builds a safe filename from contract number", () => {
    expect(buildContractPdfFilename("CT-20260716-0016")).toBe(
      "contract_CT-20260716-0016.pdf",
    );
  });
});

describe("purchasePayloadToFormValues", () => {
  // 러그 동의 값이 빠지면 PDF에 체크가 표시되지 않는다
  it("keeps rug notice agreements for the PDF", () => {
    const values = purchasePayloadToFormValues({
      products: [],
      largeRugNoticeAgreed: true,
      size4DeliveryAgreed: true,
    } as unknown as PurchaseContractPayload);
    expect(values.largeRugNoticeAgreed).toBe(true);
    expect(values.size4DeliveryAgreed).toBe(true);
  });

  it("keeps slip pad purchase for the PDF", () => {
    const values = purchasePayloadToFormValues({
      products: [],
      padPurchased: true,
      padQuantity: "2",
    } as unknown as PurchaseContractPayload);
    expect(values.padPurchased).toBe(true);
    expect(values.padQuantity).toBe("2");
  });
});
