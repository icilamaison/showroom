import { describe, expect, it } from "vitest";
import {
  applyTotalDiscount,
  contractTotal,
  formatAmount,
  formatDigits,
  lineAmount,
  toDigits,
} from "./contract-amount";

describe("contract-amount", () => {
  it("수량 × 단가로 줄 금액을 계산한다", () => {
    expect(lineAmount({ quantity: "2", unitPrice: "50000" })).toBe(100000);
    expect(lineAmount({ quantity: "1", unitPrice: "30000" })).toBe(30000);
  });

  it("전체 할인율을 소계에 적용한다", () => {
    expect(applyTotalDiscount(163100, "5")).toBe(154945);
    expect(applyTotalDiscount(20000, "10")).toBe(18000);
    expect(applyTotalDiscount(10000, "")).toBe(10000);
  });

  it("빈칸이나 숫자가 아니면 0으로 처리한다", () => {
    expect(lineAmount({ quantity: "", unitPrice: "50000" })).toBe(0);
    expect(lineAmount({ quantity: "3", unitPrice: "" })).toBe(0);
    expect(lineAmount({ quantity: "abc", unitPrice: "50000" })).toBe(0);
  });

  it("모든 줄의 합계를 낸다", () => {
    expect(
      contractTotal([
        { quantity: "2", unitPrice: "50000" },
        { quantity: "1", unitPrice: "30000" },
        { quantity: "", unitPrice: "" },
      ]),
    ).toBe(130000);
  });

  it("천단위 콤마로 포맷한다", () => {
    expect(formatAmount(130000)).toBe("130,000");
  });

  it("입력값에서 숫자만 추출한다", () => {
    expect(toDigits("50,000")).toBe("50000");
    expect(toDigits("1a2b3")).toBe("123");
    expect(toDigits("")).toBe("");
  });

  it("입력칸 표시용으로 콤마를 붙인다", () => {
    expect(formatDigits("50000")).toBe("50,000");
    expect(formatDigits("50,000")).toBe("50,000");
    expect(formatDigits("")).toBe("");
  });
});
