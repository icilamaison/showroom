import { describe, expect, it } from "vitest";
import { buildContractPdfFilename } from "./contract-document";

describe("buildContractPdfFilename", () => {
  it("builds a safe filename from contract number", () => {
    expect(buildContractPdfFilename("CT-20260716-0016")).toBe(
      "contract_CT-20260716-0016.pdf",
    );
  });
});
