/**
 * product.json의 색상·사이즈별 품절 여부를 카페24 Admin API(variants)로 반영하는 스크립트.
 * sync-stock-from-cafe24.ts(공개 상세페이지 파싱)를 대체한다. 차이는 세 가지다.
 *   - 미진열(display=F) 상품도 조회된다. HTML에는 옵션 데이터가 아예 렌더링되지 않아 32건이 실패했다.
 *   - 재고 수량(quantity)이 그대로 온다. 플래그로 추정할 필요가 없다.
 *   - 목록 API에 embed=variants를 붙여 100건씩 받는다. 상품당 1회 요청이 아니다.
 *
 *   npx tsx scripts/sync-stock-from-variants.ts           # dry-run
 *   npx tsx scripts/sync-stock-from-variants.ts --write   # 반영
 *
 * 토큰은 scripts/lib/cafe24-auth.ts (.cafe24-tokens.json) 를 쓴다.
 *
 * 세트(구성품) 상품은 variants가 구성품 재고를 반영하지 않아 제외한다.
 * 그쪽은 sync-stock-from-cafe24.ts의 set_option_data 경로를 그대로 쓴다.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getAccessToken, loadCafe24Config } from "./lib/cafe24-auth";

const JSON_PATH = path.join(process.cwd(), "product.json");
const WRITE = process.argv.includes("--write");
const PAGE_SIZE = 100;
const REQUEST_INTERVAL_MS = 120;

type Variant = {
  options?: { name?: string; value?: string }[];
  display?: string;
  selling?: string;
  use_inventory?: string;
  quantity?: number;
};

type ApiProduct = {
  product_no: number;
  product_name: string;
  variants?: Variant[];
};

type CatalogSizeOption = string | { name: string; components?: unknown[] };

type CatalogProduct = {
  productNo: number;
  productName: string;
  colors?: Record<string, string>;
  sizes?: CatalogSizeOption[];
  soldOutColors?: string[];
  soldOutSizes?: string[];
  components?: unknown[];
  [key: string]: unknown;
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSizeOptionName(option: CatalogSizeOption): string {
  return typeof option === "string" ? option : option.name;
}

// SET 번들의 sizes[]는 사이즈가 아니라 구성품 조합이므로 SIZE 축 대상이 아니다.
function hasNestedComponents(sizes: CatalogSizeOption[]): boolean {
  return sizes.some(
    (option) =>
      typeof option === "object" &&
      Array.isArray(option.components) &&
      option.components.length > 0,
  );
}

async function fetchAllProducts(mallId: string, accessToken: string): Promise<ApiProduct[]> {
  const products: ApiProduct[] = [];
  let offset = 0;

  for (;;) {
    const response = await fetch(
      `https://${mallId}.cafe24api.com/api/v2/admin/products?limit=${PAGE_SIZE}&offset=${offset}&embed=variants`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    const body = await response.text();
    if (!response.ok) {
      throw new Error(`상품 조회 실패 (${response.status})\n${body}`);
    }

    const data = JSON.parse(body) as { products: ApiProduct[] };
    products.push(...data.products);
    console.log(`[products] ${products.length}건 수집`);

    if (data.products.length < PAGE_SIZE) break;

    offset += PAGE_SIZE;
    await wait(REQUEST_INTERVAL_MS);
  }

  return products;
}

// 재고를 쓰지 않는 옵션(use_inventory=F)은 수량이 0으로 와도 품절이 아니다. 무한판매 설정이다.
function isLive(variant: Variant): boolean {
  if (variant.display !== "T" || variant.selling !== "T") return false;
  if (variant.use_inventory !== "T") return true;
  return (variant.quantity ?? 0) > 0;
}

// 같은 이름이 여러 조합에 걸쳐 있으면(TYPE×COLOR) 하나라도 살아있을 때 판매중으로 본다.
function findSoldOutNames(
  variants: Variant[],
  axis: "COLOR" | "SIZE",
  names: string[],
): string[] {
  const liveByName = new Map<string, boolean>();

  for (const variant of variants) {
    for (const option of variant.options ?? []) {
      if (option.name !== axis || !option.value) continue;
      const name = option.value.trim();
      liveByName.set(name, (liveByName.get(name) ?? false) || isLive(variant));
    }
  }

  return names.filter((name) => liveByName.get(name) === false);
}

function applyIfChanged(
  target: CatalogProduct,
  key: "soldOutColors" | "soldOutSizes",
  values: string[],
): boolean {
  const before = JSON.stringify(target[key] ?? []);
  const after = JSON.stringify(values);

  if (values.length > 0) {
    target[key] = values;
  } else {
    delete target[key];
  }

  return before !== after;
}

// 이전·현재 품절 목록을 비교해 새로 품절된 옵션과 재입고된 옵션을 나눠 담는다.
function collectStockChanges(
  label: string,
  before: string[],
  after: string[],
  newlySoldOut: string[],
  restocked: string[],
): void {
  const added = after.filter((name) => !before.includes(name));
  const removed = before.filter((name) => !after.includes(name));
  if (added.length > 0) newlySoldOut.push(`${label}: ${added.join(", ")}`);
  if (removed.length > 0) restocked.push(`${label}: ${removed.join(", ")}`);
}

async function main(): Promise<void> {
  const { mallId } = loadCafe24Config();
  const accessToken = await getAccessToken();

  const products = await fetchAllProducts(mallId, accessToken);
  const variantsByProductNo = new Map(
    products.map((product) => [product.product_no, product.variants ?? []]),
  );

  const catalog = JSON.parse(readFileSync(JSON_PATH, "utf8")) as CatalogProduct[];
  let updated = 0;
  let skipped = 0;
  let missing = 0;
  const newlySoldOut: string[] = [];
  const restocked: string[] = [];

  for (const product of catalog) {
    // 세트 상품의 재고는 구성품에 있다. variants로는 판단할 수 없다.
    if ((product.components?.length ?? 0) > 0) {
      skipped += 1;
      continue;
    }

    const variants = variantsByProductNo.get(product.productNo);
    if (!variants) {
      missing += 1;
      console.error(`✗ API에 없음: ${product.productName} (${product.productNo})`);
      continue;
    }

    const colorNames = Object.keys(product.colors ?? {});
    const sizeNames =
      product.sizes?.length && !hasNestedComponents(product.sizes)
        ? product.sizes.map(getSizeOptionName)
        : [];

    if (colorNames.length === 0 && sizeNames.length === 0) continue;

    const label = `${product.productName} (${product.productNo})`;
    let changed = false;

    if (colorNames.length > 0) {
      const before = product.soldOutColors ?? [];
      const soldOut = findSoldOutNames(variants, "COLOR", colorNames);
      if (applyIfChanged(product, "soldOutColors", soldOut)) {
        collectStockChanges(label, before, soldOut, newlySoldOut, restocked);
        changed = true;
      }
    }

    if (sizeNames.length > 0) {
      const before = product.soldOutSizes ?? [];
      const soldOut = findSoldOutNames(variants, "SIZE", sizeNames);
      if (applyIfChanged(product, "soldOutSizes", soldOut)) {
        collectStockChanges(label, before, soldOut, newlySoldOut, restocked);
        changed = true;
      }
    }

    if (changed) updated += 1;
  }

  /* ---------- 새로 품절 / 재입고 ---------- */
  console.log(`\n[새로 품절] ${newlySoldOut.length}건`);
  for (const line of newlySoldOut) console.log(`  ${line}`);
  console.log(`\n[재입고] ${restocked.length}건`);
  for (const line of restocked) console.log(`  ${line}`);

  if (WRITE) {
    writeFileSync(JSON_PATH, `${JSON.stringify(catalog, null, 4)}\n`, "utf8");
    console.log(
      `\n✓ product.json 반영 완료 (변경 ${updated}건, 세트 제외 ${skipped}건, API 누락 ${missing}건)`,
    );
  } else {
    console.log(
      `\n(dry-run) 변경 ${updated}건, 세트 제외 ${skipped}건, API 누락 ${missing}건 — 반영하려면 --write 옵션으로 실행`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(`[sync] 실패: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
