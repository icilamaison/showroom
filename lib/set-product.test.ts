import { describe, expect, it } from "vitest";
import {
  buildSetSelectionsFromColor,
  createSetComponentSelections,
  formatSetOptionName,
  parseSetColorOptions,
} from "./set-product";

describe("createSetComponentSelections", () => {
  it("auto-selects single color and size options with quantity and price", () => {
    const selections = createSetComponentSelections([
      {
        productCode: "P0000BGR",
        name: "쿨포터 냉감 패드 패밀리 260X205",
        quantity: 1,
        consumerPrice: 253500,
        colors: ["화이트 패밀리 260X205"],
      },
      { name: "베개커버", sizes: ["50X70"], quantity: 2, consumerPrice: 31850 },
    ]);

    expect(selections).toEqual([
      {
        color: "화이트 패밀리 260X205",
        size: "",
        quantity: "1",
        unitPrice: "253500",
      },
      {
        color: "",
        size: "50X70",
        quantity: "2",
        unitPrice: "31850",
      },
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
        {
          color: "화이트 K 180X205",
          size: "",
          quantity: "1",
          unitPrice: "100",
        },
        {
          color: "화이트 QK겸용 200X210",
          size: "",
          quantity: "1",
          unitPrice: "200",
        },
        { color: "", size: "50X70", quantity: "2", unitPrice: "50" },
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
        {
          name: "패드",
          colors: ["화이트 K 180X205"],
          quantity: 1,
          consumerPrice: 100000,
        },
        {
          name: "홑이불",
          colors: ["화이트 QK겸용 200X210"],
          quantity: 1,
          consumerPrice: 80000,
        },
        {
          name: "베개커버",
          sizes: ["50X70"],
          quantity: 2,
          consumerPrice: 30000,
        },
      ],
      "COLOR=화이트 K 180X205 + 화이트 QK겸용 200X210 + 50X70",
    );

    expect(selections).toEqual([
      {
        color: "화이트 K 180X205",
        size: "",
        quantity: "1",
        unitPrice: "100000",
      },
      {
        color: "화이트 QK겸용 200X210",
        size: "",
        quantity: "1",
        unitPrice: "80000",
      },
      { color: "", size: "50X70", quantity: "2", unitPrice: "30000" },
    ]);
  });
});
