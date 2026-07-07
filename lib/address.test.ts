import { describe, expect, it } from "vitest";
import { formatFullAddress } from "./address";

describe("formatFullAddress", () => {
  it("joins base and detail address", () => {
    expect(
      formatFullAddress("서울시 강남구 테헤란로 1", "101동 1001호"),
    ).toBe("서울시 강남구 테헤란로 1 101동 1001호");
  });
});
