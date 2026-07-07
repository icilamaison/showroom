import { describe, expect, it } from "vitest";
import {
  buildSetSelectionsFromColor,
  createSetComponentSelections,
  formatSetOptionName,
  parseSetColorOptions,
} from "./set-product";

describe("createSetComponentSelections", () => {
  it("auto-selects single color and size options", () => {
    const selections = createSetComponentSelections([
      { name: "패드", colors: ["화이트 SS 110X205"] },
      { name: "베개커버", sizes: ["50X70"] },
    ]);

    expect(selections).toEqual([
      { color: "화이트 SS 110X205", size: "" },
      { color: "", size: "50X70" },
    ]);
  });
});

describe("formatSetOptionName", () => {
  it("joins component options with COLOR= prefix", () => {
    const optionName = formatSetOptionName(
      [
        { name: "패드", colors: ["화이트 K 180X205"] },
        { name: "홑이불", colors: ["화이트 QK겸용 200X210"] },
        { name: "베개커버", sizes: ["50X70"] },
      ],
      [
        { color: "화이트 K 180X205", size: "" },
        { color: "화이트 QK겸용 200X210", size: "" },
        { color: "", size: "50X70" },
      ],
    );

    expect(optionName).toBe(
      "COLOR=화이트 K 180X205 + 화이트 QK겸용 200X210 + 50X70",
    );
  });
});

describe("parseSetColorOptions", () => {
  it("parses COLOR= joined options", () => {
    expect(
      parseSetColorOptions(
        "COLOR=화이트 K 180X205 + 화이트 QK겸용 200X210 + 50X70",
      ),
    ).toEqual(["화이트 K 180X205", "화이트 QK겸용 200X210", "50X70"]);
  });
});

describe("buildSetSelectionsFromColor", () => {
  it("maps parsed options back to component selections", () => {
    const selections = buildSetSelectionsFromColor(
      [
        { name: "패드", colors: ["화이트 K 180X205"] },
        { name: "홑이불", colors: ["화이트 QK겸용 200X210"] },
        { name: "베개커버", sizes: ["50X70"] },
      ],
      "COLOR=화이트 K 180X205 + 화이트 QK겸용 200X210 + 50X70",
    );

    expect(selections).toEqual([
      { color: "화이트 K 180X205", size: "" },
      { color: "화이트 QK겸용 200X210", size: "" },
      { color: "", size: "50X70" },
    ]);
  });
});
