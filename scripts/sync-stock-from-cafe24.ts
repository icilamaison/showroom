/**
 * product.json에 색상별(SET 상품은 구성품별) 품절 여부를 반영하는 스크립트.
 * 카페24 공개 상세페이지(product_no)에서 재고 데이터를 파싱한다. API 토큰 불필요.
 * - 일반 상품: var option_stock_data = '...' (재고수량/판매여부)
 * - SET(구성상품 번들): var set_option_data = '...' (구성품별로 각자의 option_stock_data를 중첩해서 가짐)
 *
 *   npx tsx scripts/sync-stock-from-cafe24.ts           # dry-run
 *   npx tsx scripts/sync-stock-from-cafe24.ts --write   # 반영
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE_URL = "https://icilamaison.com/product/detail.html?product_no=";
const WRITE = process.argv.includes("--write");

type SetComponent = {
  name: string;
  colors?: string[];
  sizes?: string[];
  soldOutColors?: string[];
  soldOutSizes?: string[];
  [key: string]: unknown;
};

type CatalogSizeOption =
  | string
  | { name: string; components?: unknown[]; [key: string]: unknown };

type CatalogProduct = {
  productNo: number;
  productName: string;
  colors?: Record<string, string>;
  sizes?: CatalogSizeOption[];
  soldOutColors?: string[];
  soldOutSizes?: string[];
  components?: SetComponent[];
  [key: string]: unknown;
};

function getSizeOptionName(option: CatalogSizeOption): string {
  return typeof option === "string" ? option : option.name;
}

// SET 번들의 sizes[]는 "사이즈"가 아니라 완전히 다른 구성품 조합을 나타내므로(components 포함),
// 이 경우는 SIZE 축 품절 체크 대상에서 제외 — 이미 top-level colors로 동일한 이름을 따로 체크함
function hasNestedComponents(sizes: CatalogSizeOption[]): boolean {
  return sizes.some(
    (option) =>
      typeof option === "object" &&
      Array.isArray(option.components) &&
      option.components.length > 0,
  );
}

type StockEntry = {
  option_name: string;
  option_value: string;
  stock_number: number;
  is_selling: string;
  use_stock: boolean;
};

type SetOptionEntry = {
  product_name: string;
  option_stock_data?: string;
};

// 카페24 상세페이지에 박혀 있는 'var xxx = "...";' JS 문자열을 JSON으로 복원
function unescapeJsString(raw: string): string {
  return raw.replace(/\\u([0-9a-fA-F]{4})|\\(.)/g, (_match, unicode, char) => {
    if (unicode) {
      return String.fromCharCode(parseInt(unicode, 16));
    }
    return char;
  });
}

function extractJsStringVar(html: string, varName: string): string | null {
  const match = html.match(
    new RegExp(`var ${varName} = '((?:\\\\.|[^'\\\\])*)';`),
  );
  return match ? match[1] : null;
}

function parseOptionStockData(html: string): Record<string, StockEntry> | null {
  const raw = extractJsStringVar(html, "option_stock_data");
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(unescapeJsString(raw));
  } catch {
    return null;
  }
}

// SET 상품: 구성품마다 자기 product_no로 묶인 재고 정보를 갖고 있음 (product_name으로 우리 쪽 컴포넌트와 매칭)
function parseSetOptionData(html: string): SetOptionEntry[] | null {
  const raw = extractJsStringVar(html, "set_option_data");
  if (!raw) {
    return null;
  }

  try {
    const outer = JSON.parse(unescapeJsString(raw)) as Record<string, SetOptionEntry>;
    return Object.values(outer);
  } catch {
    return null;
  }
}

// COLOR#$%SIZE / COLOR(또는 SIZE) 형태의 option_name·option_value에서 해당 축의 이름만 뽑아,
// 그 이름의 모든 조합이 품절일 때만 품절로 판단
function findSoldOutNames(
  entries: StockEntry[],
  axis: "COLOR" | "SIZE",
  names: string[],
): string[] {
  const hasStockByName = new Map<string, boolean>();

  for (const entry of entries) {
    const axes = entry.option_name.split("#$%");
    const axisIndex = axes.indexOf(axis);
    if (axisIndex === -1) {
      continue;
    }

    const name = entry.option_value.split("-")[axisIndex]?.trim();
    if (!name) {
      continue;
    }

    const inStock = entry.use_stock
      ? Number(entry.stock_number) > 0 && entry.is_selling === "T"
      : entry.is_selling === "T";

    hasStockByName.set(name, (hasStockByName.get(name) ?? false) || inStock);
  }

  return names.filter((name) => hasStockByName.get(name) === false);
}

function applyIfChanged<T extends Record<string, unknown>>(
  target: T,
  key: keyof T,
  values: string[],
): boolean {
  const before = JSON.stringify(target[key] ?? []);
  const after = JSON.stringify(values);

  if (values.length > 0) {
    target[key] = values as never;
  } else {
    delete target[key];
  }

  return before !== after;
}

async function fetchDetailHtml(productNo: number): Promise<string> {
  const res = await fetch(`${BASE_URL}${productNo}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return res.text();
}

async function main() {
  const jsonPath = path.join(process.cwd(), "product.json");
  const catalog = JSON.parse(readFileSync(jsonPath, "utf8")) as CatalogProduct[];

  let updated = 0;
  let failed = 0;

  for (const product of catalog) {
    const colorNames = product.colors ? Object.keys(product.colors) : [];
    const sizeNames =
      product.sizes?.length && !hasNestedComponents(product.sizes)
        ? product.sizes.map(getSizeOptionName)
        : [];
    const hasComponents = (product.components?.length ?? 0) > 0;

    if (colorNames.length === 0 && sizeNames.length === 0 && !hasComponents) {
      continue;
    }

    let html: string;
    try {
      html = await fetchDetailHtml(product.productNo);
    } catch (error) {
      failed += 1;
      console.error(`✗ ${product.productName} (${product.productNo}): ${(error as Error).message}`);
      continue;
    }

    let changed = false;

    if (colorNames.length > 0 || sizeNames.length > 0) {
      const stockData = parseOptionStockData(html);
      if (!stockData) {
        failed += 1;
        console.error(`✗ ${product.productName} (${product.productNo}): option_stock_data를 찾지 못함`);
      } else {
        const entries = Object.values(stockData);

        if (colorNames.length > 0) {
          const soldOutColors = findSoldOutNames(entries, "COLOR", colorNames);
          if (applyIfChanged(product, "soldOutColors", soldOutColors)) {
            changed = true;
            console.log(`● ${product.productName} (${product.productNo}): soldOutColors → ${JSON.stringify(soldOutColors)}`);
          }
        }

        if (sizeNames.length > 0) {
          const soldOutSizes = findSoldOutNames(entries, "SIZE", sizeNames);
          if (applyIfChanged(product, "soldOutSizes", soldOutSizes)) {
            changed = true;
            console.log(`● ${product.productName} (${product.productNo}): soldOutSizes → ${JSON.stringify(soldOutSizes)}`);
          }
        }
      }
    }

    if (hasComponents) {
      const setEntries = parseSetOptionData(html);
      if (!setEntries) {
        failed += 1;
        console.error(`✗ ${product.productName} (${product.productNo}): set_option_data를 찾지 못함`);
      } else {
        for (const component of product.components ?? []) {
          const match = setEntries.find((entry) => entry.product_name === component.name);
          if (!match?.option_stock_data) {
            continue;
          }

          let stockData: Record<string, StockEntry>;
          try {
            stockData = JSON.parse(match.option_stock_data);
          } catch {
            continue;
          }

          const entries = Object.values(stockData);

          if (component.colors?.length) {
            const soldOutColors = findSoldOutNames(entries, "COLOR", component.colors);
            if (applyIfChanged(component, "soldOutColors", soldOutColors)) {
              changed = true;
              console.log(
                `  ↳ ${component.name}: soldOutColors → ${JSON.stringify(soldOutColors)}`,
              );
            }
          }

          if (component.sizes?.length) {
            const soldOutSizes = findSoldOutNames(entries, "SIZE", component.sizes);
            if (applyIfChanged(component, "soldOutSizes", soldOutSizes)) {
              changed = true;
              console.log(
                `  ↳ ${component.name}: soldOutSizes → ${JSON.stringify(soldOutSizes)}`,
              );
            }
          }
        }
      }
    }

    if (changed) {
      updated += 1;
    }
  }

  if (WRITE) {
    writeFileSync(jsonPath, `${JSON.stringify(catalog, null, 4)}\n`, "utf8");
    console.log(`\n✓ product.json 반영 완료 (변경 ${updated}건, 실패 ${failed}건)`);
  } else {
    console.log(`\n(dry-run) 변경 ${updated}건, 실패 ${failed}건 — 반영하려면 --write 옵션으로 실행`);
  }
}

main();
