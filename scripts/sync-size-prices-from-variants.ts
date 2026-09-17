/**
 * product.json의 사이즈별 판매가를 카페24 Admin API(variants)로 반영하는 스크립트.
 * sync-product-size-prices.ts는 수기로 내려받은 product3.xlsx를 읽었지만 이쪽은 API가 출처다.
 *
 *   npx tsx scripts/sync-size-prices-from-variants.ts           # dry-run
 *   npx tsx scripts/sync-size-prices-from-variants.ts --write   # 반영
 *
 * 사이즈 판매가 = 상품 판매가(price) + 해당 사이즈 variant의 additional_amount.
 * 추가금이 0인 사이즈는 문자열로 두고, 0보다 크면 { name, salePrice } 객체로 바꾼다.
 * sizes[]에 components가 들어 있는 세트형은 구성 조합이라 사이즈가 아니므로 건드리지 않는다.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ENV_PATH = path.join(process.cwd(), ".env.local");
const JSON_PATH = path.join(process.cwd(), "product.json");
const WRITE = process.argv.includes("--write");
const PAGE_SIZE = 100;
const REQUEST_INTERVAL_MS = 120;

type Variant = {
  options?: { name?: string; value?: string }[];
  additional_amount?: string;
};

type ApiProduct = {
  product_no: number;
  variants?: Variant[];
};

type CatalogSizeOption = string | { name: string; salePrice?: number; components?: unknown[] };

type CatalogProduct = {
  productNo: number;
  productName: string;
  salePrice?: number;
  sizes?: CatalogSizeOption[];
  [key: string]: unknown;
};

function readEnvFile(): Map<string, string> {
  const map = new Map<string, string>();
  if (!existsSync(ENV_PATH)) return map;

  for (const line of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    map.set(trimmed.slice(0, index).trim(), trimmed.slice(index + 1).trim());
  }

  return map;
}

function updateEnvValue(key: string, value: string): void {
  const original = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
  const pattern = new RegExp(`^${key}=.*$`, "m");
  const next = pattern.test(original)
    ? original.replace(pattern, `${key}=${value}`)
    : `${original}${original.endsWith("\n") || !original ? "" : "\n"}${key}=${value}\n`;

  writeFileSync(ENV_PATH, next, "utf8");
}

function requireEnv(env: Map<string, string>, key: string): string {
  const value = process.env[key] ?? env.get(key);
  if (!value) throw new Error(`${key}가 없습니다. .env.local에 추가해주세요.`);
  return value;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSizeOptionName(option: CatalogSizeOption): string {
  return typeof option === "string" ? option : option.name;
}

async function refreshAccessToken(
  mallId: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`https://${mallId}.cafe24api.com/api/v2/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`토큰 갱신 실패 (${response.status})\n${body}`);
  }

  const data = JSON.parse(body) as { access_token: string; refresh_token: string };
  updateEnvValue("CAFE24_REFRESH_TOKEN", data.refresh_token);
  console.log("[token] 갱신 완료 (새 refresh_token을 .env.local에 저장했습니다)");

  return data.access_token;
}

async function fetchAllProducts(mallId: string, accessToken: string): Promise<ApiProduct[]> {
  const products: ApiProduct[] = [];
  let offset = 0;

  for (;;) {
    const response = await fetch(
      `https://${mallId}.cafe24api.com/api/v2/admin/products?limit=${PAGE_SIZE}&offset=${offset}&embed=variants`,
      { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } },
    );

    const body = await response.text();
    if (!response.ok) throw new Error(`상품 조회 실패 (${response.status})\n${body}`);

    const data = JSON.parse(body) as { products: ApiProduct[] };
    products.push(...data.products);
    console.log(`[products] ${products.length}건 수집`);

    if (data.products.length < PAGE_SIZE) break;

    offset += PAGE_SIZE;
    await wait(REQUEST_INTERVAL_MS);
  }

  return products;
}

// 같은 사이즈가 색상마다 반복되므로 추가금이 갈리는지 확인한다. 갈리면 사이즈 단위로 정할 수 없다.
function collectSizeAddPrices(variants: Variant[]): {
  byName: Map<string, number>;
  conflicts: string[];
} {
  const seen = new Map<string, Set<number>>();

  for (const variant of variants) {
    for (const option of variant.options ?? []) {
      if (option.name !== "SIZE" || !option.value) continue;
      const name = option.value.trim();
      const amount = Number(variant.additional_amount ?? 0);
      const set = seen.get(name) ?? new Set<number>();
      set.add(Number.isNaN(amount) ? 0 : amount);
      seen.set(name, set);
    }
  }

  const byName = new Map<string, number>();
  const conflicts: string[] = [];

  for (const [name, amounts] of seen) {
    if (amounts.size > 1) {
      conflicts.push(`${name} (${[...amounts].join("/")})`);
      continue;
    }
    byName.set(name, [...amounts][0]);
  }

  return { byName, conflicts };
}

async function main(): Promise<void> {
  const env = readEnvFile();
  const mallId = process.env.CAFE24_MALL_ID ?? env.get("CAFE24_MALL_ID") ?? "icilamaison";
  const accessToken = await refreshAccessToken(
    mallId,
    requireEnv(env, "CAFE24_CLIENT_ID"),
    requireEnv(env, "CAFE24_CLIENT_SECRET"),
    requireEnv(env, "CAFE24_REFRESH_TOKEN"),
  );

  const variantsByProductNo = new Map(
    (await fetchAllProducts(mallId, accessToken)).map((product) => [
      product.product_no,
      product.variants ?? [],
    ]),
  );

  const catalog = JSON.parse(readFileSync(JSON_PATH, "utf8")) as CatalogProduct[];
  let updated = 0;
  const conflicted: string[] = [];

  for (const product of catalog) {
    const sizes = product.sizes;
    const basePrice = product.salePrice;
    if (!sizes?.length || !basePrice) continue;

    // 세트 조합은 사이즈가 아니다.
    if (sizes.some((size) => typeof size === "object" && Array.isArray(size.components))) continue;

    const variants = variantsByProductNo.get(product.productNo);
    if (!variants?.length) continue;

    const { byName, conflicts } = collectSizeAddPrices(variants);
    if (conflicts.length > 0) {
      conflicted.push(`${product.productNo} ${product.productName}: ${conflicts.join(", ")}`);
    }

    const changes: string[] = [];
    const nextSizes = sizes.map((size) => {
      const name = getSizeOptionName(size);
      const addPrice = byName.get(name);
      if (addPrice === undefined) return size;

      const salePrice = basePrice + addPrice;
      const before = typeof size === "object" ? size.salePrice : undefined;
      if (before === salePrice || (addPrice === 0 && before === undefined)) return size;

      changes.push(`${name} ${before ?? basePrice} → ${salePrice}`);
      return addPrice > 0 ? { ...(typeof size === "object" ? size : {}), name, salePrice } : name;
    });

    if (changes.length > 0) {
      product.sizes = nextSizes;
      updated += 1;
      console.log(`● ${product.productName} (${product.productNo})`);
      for (const change of changes) console.log(`    ${change}`);
    }
  }

  if (conflicted.length > 0) {
    console.log(`\n[색상마다 추가금이 다름] ${conflicted.length}건 — 사이즈 단위로 정할 수 없어 건너뜀`);
    for (const line of conflicted) console.log(`  ${line}`);
  }

  if (WRITE) {
    writeFileSync(JSON_PATH, `${JSON.stringify(catalog, null, 4)}\n`, "utf8");
    console.log(`\n✓ product.json 반영 완료 (변경 ${updated}건)`);
  } else {
    console.log(`\n(dry-run) 변경 ${updated}건 — 반영하려면 --write 옵션으로 실행`);
  }
}

main().catch((error: unknown) => {
  console.error(`[sync] 실패: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
