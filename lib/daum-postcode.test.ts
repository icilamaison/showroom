import { describe, expect, it } from "vitest";
import { formatDaumAddress } from "./daum-postcode";

describe("formatDaumAddress", () => {
  it("uses road address with building name", () => {
    expect(
      formatDaumAddress({
        zonecode: "06234",
        roadAddress: "서울 강남구 테헤란로 1",
        jibunAddress: "서울 강남구 역삼동 123",
        buildingName: "강남빌딩",
      }),
    ).toBe("서울 강남구 테헤란로 1 (강남빌딩)");
  });

  it("falls back to jibun address", () => {
    expect(
      formatDaumAddress({
        zonecode: "06234",
        roadAddress: "",
        jibunAddress: "서울 강남구 역삼동 123",
        buildingName: "",
      }),
    ).toBe("서울 강남구 역삼동 123");
  });
});
