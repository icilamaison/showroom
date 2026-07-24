/**
 * product.json의 가격(소비자가/판매가/공급가, 사이즈별 추가금)을 카페24 공개 상세페이지에서 최신화하는 스크립트.
 * API 토큰 불필요.
 *
 *   npx tsx scripts/sync-prices-from-cafe24.ts           # dry-run
 *   npx tsx scripts/sync-prices-from-cafe24.ts --write   # 반영
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE_URL = "https://icilamaison.com/product/detail.html?product_no=";
const WRITE = process.argv.includes("--write");

type CatalogSizeOption =
  | string
  | {
      name: string;
      consumerPrice?: number;
      salePrice?: number;
      components?: unknown[];
      [key: string]: unknown;
    };

type CatalogProduct = {
  productNo: number;
  productName: string;
  consumerPrice: number;
  productPrice: number;
  salePrice: number;
  sizes?: CatalogSizeOption[];
  [key: string]: unknown;
};

type StockEntry = {
  option_name: string;
  option_value: string;
  option_price?: number;
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

function parsePriceBox(html: string): { sale: number; consumer: number } | null {
  const match = html.match(
    /class="price_box"\s+data-price="([\d.]+)"\s+data-custom="([\d.]+)"/,
  );
  if (!match) {
    return null;
  }

  return {
    sale: Math.round(Number(match[1])),
    consumer: Math.round(Number(match[2])),
  };
}

function parseOptionStockData(html: string): Record<string, StockEntry> | null {
  const match = html.match(/var option_stock_data = '((?:\\.|[^'\\])*)';/);
  if (!match) {
    return null;
  }

  try {
    return JSON.parse(unescapeJsString(match[1]));
  } catch {
    return null;
  }
}

function getSizeOptionName(option: CatalogSizeOption): string {
  return typeof option === "string" ? option : option.name;
}

// SET 번들처럼 사이즈 옵션이 "완전히 다른 구성품 조합"을 나타내는 경우(components 포함)는
// 단순 사이즈 추가금 로직으로 건드리면 구성 정보가 깨지므로 건너뜀
function hasNestedComponents(sizes: CatalogSizeOption[]): boolean {
  return sizes.some(
    (option) =>
      typeof option === "object" &&
      Array.isArray(option.components) &&
      option.components.length > 0,
  );
}

// SIZE 축 옵션별 실제 판매가(option_price)를 모음. 컬러가 있어도 사이즈 가격은 동일하다는 걸
// 확인했으므로(카페24 옵션 구조상 색상은 가격에 영향 없음), 같은 사이즈면 마지막 값으로 덮어씀.
function buildSizePriceMap(entries: StockEntry[]): Map<string, number> {
  const priceBySize = new Map<string, number>();

  for (const entry of entries) {
    if (entry.option_price == null) {
      continue;
    }

    const axes = entry.option_name.split("#$%");
    const sizeIndex = axes.indexOf("SIZE");
    if (sizeIndex === -1) {
      continue;
    }

    const name = entry.option_value.split("-")[sizeIndex]?.trim();
    if (!name) {
      continue;
    }

    priceBySize.set(name, Math.round(Number(entry.option_price)));
  }

  return priceBySize;
}

function applySizePrices(
  sizes: CatalogSizeOption[],
  priceBySize: Map<string, number>,
  baseSalePrice: number,
): CatalogSizeOption[] {
  return sizes.map((option) => {
    const name = getSizeOptionName(option);
    const price = priceBySize.get(name);

    if (price == null) {
      return option;
    }

    if (price === baseSalePrice) {
      if (typeof option === "string") {
        return option;
      }
      const { salePrice: _removed, ...rest } = option;
      return rest;
    }

    if (typeof option === "string") {
      return { name, salePrice: price };
    }

    return { ...option, salePrice: price };
  });
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
    let html: string;
    try {
      html = await fetchDetailHtml(product.productNo);
    } catch (error) {
      failed += 1;
      console.error(`✗ ${product.productName} (${product.productNo}): ${(error as Error).message}`);
      continue;
    }

    const priceBox = parsePriceBox(html);
    if (!priceBox) {
      failed += 1;
      console.error(`✗ ${product.productName} (${product.productNo}): price_box를 찾지 못함 (진열 중단 추정)`);
      continue;
    }

    let changed = false;
    const nextSalePrice = priceBox.sale;
    // data-custom(정가)이 0이면 몰에서 별도 정가를 안 보여주는 것 — 기존 소비자가 값을 임의로 덮어쓰지 않음
    const nextConsumerPrice = priceBox.consumer > 0 ? priceBox.consumer : product.consumerPrice;
    const nextProductPrice = Math.round(nextSalePrice / 1.1);

    if (
      product.salePrice !== nextSalePrice ||
      product.consumerPrice !== nextConsumerPrice ||
      product.productPrice !== nextProductPrice
    ) {
      changed = true;
      console.log(
        `● ${product.productName} (${product.productNo}): ${product.salePrice} → ${nextSalePrice}원`,
      );
      product.salePrice = nextSalePrice;
      product.consumerPrice = nextConsumerPrice;
      product.productPrice = nextProductPrice;
    }

    if (product.sizes?.length && !hasNestedComponents(product.sizes)) {
      const stockData = parseOptionStockData(html);
      if (stockData) {
        const priceBySize = buildSizePriceMap(Object.values(stockData));
        const nextSizes = applySizePrices(product.sizes, priceBySize, nextSalePrice);

        if (JSON.stringify(nextSizes) !== JSON.stringify(product.sizes)) {
          changed = true;
          console.log(`  ↳ 사이즈별 가격 → ${JSON.stringify(nextSizes)}`);
          product.sizes = nextSizes;
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
