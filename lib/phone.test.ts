import { describe, expect, it } from "vitest";
import { formatPhoneInput } from "./phone";

describe("formatPhoneInput", () => {
  it("inserts hyphens while typing", () => {
    expect(formatPhoneInput("0")).toBe("0");
    expect(formatPhoneInput("010")).toBe("010");
    expect(formatPhoneInput("0101")).toBe("010-1");
    expect(formatPhoneInput("0101234")).toBe("010-1234");
    expect(formatPhoneInput("01012345678")).toBe("010-1234-5678");
  });

  it("strips non-digits and limits to 11 digits", () => {
    expect(formatPhoneInput("010-1234-5678")).toBe("010-1234-5678");
    expect(formatPhoneInput("010123456789012")).toBe("010-1234-5678");
  });
});
