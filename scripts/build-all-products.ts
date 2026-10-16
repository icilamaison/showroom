/**
 * 카페24 Admin API로 all_product.json 하나만 만든다.
 * (참고: skin31 tools/build-all-products.mjs 의 통합 JSON 생성 부분만)
 *
 *   npx tsx scripts/build-all-products.ts
 *
 * 사이즈 안내·프로모션·러그 카탈로그 파생 산출물은 만들지 않는다.
 * 결과 파일(all_product.json)은 직접 수정하지 않는다.
 *
 * .env.local:
 *   CAFE24_MALL_ID / CAFE24_CLIENT_ID / CAFE24_CLIENT_SECRET / CAFE24_REFRESH_TOKEN
 * 권장 scope: mall.read_product, mall.read_category, mall.read_promotion
 */

import assert from "node:assert/strict";
import {
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, ".env.local");
const OUTPUT_PATH = path.join(ROOT, "all_product.json");
const TEMP_PATH = `${OUTPUT_PATH}.tmp`;

const API_VERSION = "2026-03-01";
const REQUEST_INTERVAL_MS = 550;
const REQUEST_TIMEOUT_MS = 45_000;
const EXCLUDED_CATEGORY_NOS = new Set([173, 188]);
const EXCLUDED_NAME_KEYWORDS = ["공동구매"];
const BENEFIT_NOS = [117, 118, 114, 113, 112, 111, 110, 109, 107];

const PRODUCT_FIELDS = [
  "product_no",
  "product_code",
  "custom_product_code",
  "product_name",
  "internal_product_name",
  "summary_description",
  "price_excluding_tax",
  "price",
  "retail_price",
  "display",
  "selling",
  "sold_out",
  "set_product_type",
  "product_tag",
  "detail_image",
  "list_image",
  "tiny_image",
  "small_image",
  "created_date",
  "updated_date",
].join(",");

type EnvMap = Map<string, string>;

type Cafe24Product = {
  product_no: number;
  product_code?: string;
  custom_product_code?: string;
  product_name?: string;
  internal_product_name?: string;
  summary_description?: string;
  price_excluding_tax?: string;
  price?: string;
  retail_price?: string;
  display?: string;
  selling?: string;
  sold_out?: string;
  set_product_type?: string;
  product_tag?: string[];
  detail_image?: string;
  list_image?: string;
  tiny_image?: string;
  small_image?: string;
  created_date?: string;
  updated_date?: string;
};

type MappedOption = {
  name: string;
  required: boolean;
  values: Array<{ name: string; option_text?: string; hex?: string }>;
};

type MappedCategory = {
  category_no: number;
  name: string;
  path: Array<{ category_no: number; name: string }>;
};

type MappedBenefit = {
  benefit_no: number;
  type: string;
  name: string;
};

type MappedProduct = {
  product_no: number;
  product_code: string;
  custom_product_code: string;
  product_name: string;
  internal_product_name: string;
  summary: string;
  prices: { consumer: number; selling: number; excluding_tax: number };
  status: { display: boolean; selling: boolean; sold_out: boolean };
  categories: MappedCategory[];
  tags: string[];
  options: MappedOption[];
  images: { detail: string; list: string; small: string; tiny: string };
  benefits: MappedBenefit[];
  created_at: string | null;
  updated_at: string | null;
};

type Catalog = {
  generated_at: string;
  source: "cafe24-admin-api";
  product_count: number;
  option_fetch_failures: number;
  products: Record<string, MappedProduct>;
};

let nextRequestAt = 0;

function readEnvFile(): EnvMap {
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

function requireEnv(env: EnvMap, key: string): string {
  const value = process.env[key] ?? env.get(key);
  if (!value) {
    throw new Error(`${key}가 없습니다. .env.local에 추가해주세요. (${ENV_PATH})`);
  }
  return value;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function refreshAccessToken(
  mallId: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(
    `https://${mallId}.cafe24api.com/api/v2/oauth/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`토큰 갱신 실패 (HTTP ${response.status}): ${text}`);
  }

  const data = JSON.parse(text) as {
    access_token: string;
    refresh_token: string;
    expires_at?: string;
  };
  updateEnvValue("CAFE24_REFRESH_TOKEN", data.refresh_token);
  console.log(`[token] 갱신 완료 (만료: ${data.expires_at ?? "미표기"})`);
  return data.access_token;
}

async function api(
  mallId: string,
  accessToken: string,
  pathname: string,
  attempt = 0,
): Promise<unknown> {
  const delay = Math.max(0, nextRequestAt - Date.now());
  if (delay) await sleep(delay);
  nextRequestAt = Date.now() + REQUEST_INTERVAL_MS;

  try {
    const response = await fetch(
      `https://${mallId}.cafe24api.com/api/v2/admin/${pathname}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Cafe24-Api-Version": API_VERSION,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    const text = await response.text();

    if ((response.status === 429 || response.status >= 500) && attempt < 6) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const wait =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 1000 * (attempt + 1);
      console.error(`API ${response.status}, ${wait}ms 후 재시도 ${attempt + 1}/6: ${pathname}`);
      await sleep(wait);
      return api(mallId, accessToken, pathname, attempt + 1);
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);
    }
    return JSON.parse(text);
  } catch (error) {
    if (attempt >= 6 || String((error as Error).message).startsWith("HTTP 4")) {
      throw error;
    }
    console.error(`API 오류, 재시도 ${attempt + 1}/6: ${pathname}`);
    await sleep(1000 * (attempt + 1));
    return api(mallId, accessToken, pathname, attempt + 1);
  }
}

function categoryPath(category: {
  full_category_name?: Record<string, string>;
  full_category_no?: Record<string, number>;
}): Array<{ category_no: number; name: string }> {
  const names = category.full_category_name || {};
  const numbers = category.full_category_no || {};
  return [1, 2, 3, 4]
    .filter((depth) => numbers[String(depth)] && names[String(depth)])
    .map((depth) => ({
      category_no: numbers[String(depth)],
      name: names[String(depth)],
    }));
}

function mapOptions(optionResponse: {
  options?: Array<{
    option_name?: string;
    required_option?: string;
    option_value?: Array<{ option_text?: string; option_color?: string }>;
  }>;
} | null): MappedOption[] {
  return (optionResponse?.options || []).map((option) => ({
    name: String(option.option_name || "").trim(),
    required: option.required_option === "T",
    values: (option.option_value || []).map((value) => {
      const rawName = String(value.option_text || "").trim();
      if (String(option.option_name || "").toUpperCase() !== "COLOR") {
        return { name: rawName };
      }
      return {
        name: rawName,
        option_text: rawName,
        hex: String(value.option_color || "").toUpperCase(),
      };
    }),
  }));
}

function mapProduct(
  product: Cafe24Product,
  categories: MappedCategory[],
  options: MappedOption[],
): Omit<MappedProduct, "benefits"> {
  return {
    product_no: product.product_no,
    product_code: product.product_code || "",
    custom_product_code: product.custom_product_code || "",
    product_name: product.product_name || "",
    internal_product_name: product.internal_product_name || "",
    summary: product.summary_description || "",
    prices: {
      consumer: Math.round(Number(product.retail_price) || 0),
      selling: Math.round(Number(product.price) || 0),
      excluding_tax: Math.round(Number(product.price_excluding_tax) || 0),
    },
    status: {
      display: product.display === "T",
      selling: product.selling === "T",
      sold_out: product.sold_out === "T",
    },
    categories,
    tags: product.product_tag || [],
    options,
    images: {
      detail: product.detail_image || "",
      list: product.list_image || "",
      small: product.small_image || "",
      tiny: product.tiny_image || "",
    },
    created_at: product.created_date || null,
    updated_at: product.updated_date || null,
  };
}

async function fetchProducts(
  mallId: string,
  accessToken: string,
): Promise<Cafe24Product[]> {
  const total = (
    (await api(mallId, accessToken, "products/count")) as { count: number }
  ).count;
  const products: Cafe24Product[] = [];
  for (let offset = 0; offset < total; offset += 100) {
    const response = (await api(
      mallId,
      accessToken,
      `products?limit=100&offset=${offset}&fields=${PRODUCT_FIELDS}`,
    )) as { products?: Cafe24Product[] };
    products.push(...(response.products || []));
    console.log(`상품 ${products.length}/${total}`);
  }
  return products;
}

async function fetchCategoryAssignments(
  mallId: string,
  accessToken: string,
  productNos: Set<number>,
): Promise<Map<number, MappedCategory[]>> {
  const categoryList: Array<{
    category_no: number;
    category_name: string;
    full_category_name?: Record<string, string>;
    full_category_no?: Record<string, number>;
  }> = [];

  for (let offset = 0; ; offset += 100) {
    const response = (await api(
      mallId,
      accessToken,
      `categories?limit=100&offset=${offset}`,
    )) as { categories?: typeof categoryList };
    const page = response.categories || [];
    categoryList.push(...page);
    if (page.length < 100) break;
  }

  const assignments = new Map(
    [...productNos].map((productNo) => [productNo, [] as MappedCategory[]]),
  );
  let done = 0;
  for (const category of categoryList) {
    const response = (await api(
      mallId,
      accessToken,
      `categories/${category.category_no}/products?display_group=1&limit=50000&fields=product_no`,
    )) as { products?: Array<{ product_no: number }> };
    const pathItems = categoryPath(category);
    for (const item of response.products || []) {
      if (assignments.has(item.product_no)) {
        assignments.get(item.product_no)!.push({
          category_no: category.category_no,
          name: category.category_name,
          path: pathItems,
        });
      }
    }
    if (++done % 25 === 0 || done === categoryList.length) {
      console.log(`분류 ${done}/${categoryList.length}`);
    }
  }
  return assignments;
}

async function fetchOptions(
  mallId: string,
  accessToken: string,
  products: Cafe24Product[],
): Promise<{ optionsByProduct: Map<number, MappedOption[]>; failed: number }> {
  const optionsByProduct = new Map<number, MappedOption[]>();
  let done = 0;
  let failed = 0;

  for (const product of products) {
    try {
      const response = (await api(
        mallId,
        accessToken,
        `products/${product.product_no}/options`,
      )) as { option?: Parameters<typeof mapOptions>[0] };
      optionsByProduct.set(product.product_no, mapOptions(response.option ?? null));
    } catch (error) {
      if (!product.set_product_type) {
        failed += 1;
        console.error(
          `옵션 실패 ${product.product_no}: ${(error as Error).message}`,
        );
      }
      optionsByProduct.set(product.product_no, []);
    }
    if (++done % 50 === 0 || done === products.length) {
      console.log(`옵션 ${done}/${products.length} (실패 ${failed})`);
    }
  }
  return { optionsByProduct, failed };
}

async function fetchBenefits(
  mallId: string,
  accessToken: string,
): Promise<Map<number, MappedBenefit[]>> {
  const benefitsByProduct = new Map<number, MappedBenefit[]>();
  for (const benefitNo of BENEFIT_NOS) {
    try {
      const { benefit } = (await api(
        mallId,
        accessToken,
        `benefits/${benefitNo}`,
      )) as {
        benefit: {
          benefit_no: number;
          benefit_type: string;
          benefit_name: string;
          gift?: Array<{ product_list?: number[] }>;
          bulk_purchase_sale?: Array<{ product_list?: number[] }>;
        };
      };
      const setting = [].concat(
        (benefit.gift || benefit.bulk_purchase_sale || []) as never[],
      )[0] as { product_list?: number[] } | undefined;
      for (const productNo of setting?.product_list || []) {
        const key = Number(productNo);
        if (!benefitsByProduct.has(key)) benefitsByProduct.set(key, []);
        benefitsByProduct.get(key)!.push({
          benefit_no: benefit.benefit_no,
          type: benefit.benefit_type,
          name: benefit.benefit_name,
        });
      }
    } catch (error) {
      console.error(`혜택 ${benefitNo} 실패: ${(error as Error).message}`);
    }
  }
  return benefitsByProduct;
}

function isExcludedName(productName: string): boolean {
  return EXCLUDED_NAME_KEYWORDS.some((keyword) =>
    String(productName || "").includes(keyword),
  );
}

function validateCatalog(catalog: Catalog): void {
  assert.equal(catalog.source, "cafe24-admin-api");
  assert.equal(catalog.product_count, Object.keys(catalog.products).length);
  for (const [key, product] of Object.entries(catalog.products)) {
    assert.equal(String(product.product_no), key);
    assert.ok(product.product_name);
    assert.ok(Array.isArray(product.categories));
    assert.ok(Array.isArray(product.options));
    assert.ok(
      product.categories.every(
        (category) => !EXCLUDED_CATEGORY_NOS.has(category.category_no),
      ),
    );
    assert.equal(isExcludedName(product.product_name), false);
    assert.equal(product.status.display, true);
  }
}

function loadPreviousCatalog(): Catalog | null {
  if (!existsSync(OUTPUT_PATH)) return null;
  try {
    return JSON.parse(readFileSync(OUTPUT_PATH, "utf8")) as Catalog;
  } catch {
    return null;
  }
}

function shortName(product: { product_no: number; product_name?: string }): string {
  return `${product.product_no} ${product.product_name || ""}`.trim();
}

function printChangeLines(label: string, lines: string[], limit = 15): void {
  if (!lines.length) return;
  console.log(`  ${label} ${lines.length}`);
  for (const line of lines.slice(0, limit)) console.log(`    - ${line}`);
  if (lines.length > limit) console.log(`    - …외 ${lines.length - limit}개`);
}

function catalogDiff(previous: Catalog | null, next: Catalog): void {
  console.log("\n[변경]");
  if (!previous?.products) {
    console.log(`  이전 파일 없음 → 신규 ${Object.keys(next.products).length}개`);
    return;
  }

  const prev = previous.products;
  const curr = next.products;
  const prevNos = new Set(Object.keys(prev));
  const currNos = new Set(Object.keys(curr));
  const added = [...currNos]
    .filter((no) => !prevNos.has(no))
    .map((no) => shortName(curr[no]));
  const removed = [...prevNos]
    .filter((no) => !currNos.has(no))
    .map((no) => shortName(prev[no]));
  const changed: string[] = [];

  for (const no of currNos) {
    if (!prevNos.has(no)) continue;
    const before = prev[no];
    const after = curr[no];
    const parts: string[] = [];
    if (before.product_name !== after.product_name) {
      parts.push(`이름 "${before.product_name}" → "${after.product_name}"`);
    }
    if (before.prices?.selling !== after.prices?.selling) {
      parts.push(
        `판매가 ${before.prices?.selling ?? "-"} → ${after.prices?.selling ?? "-"}`,
      );
    }
    if (before.prices?.consumer !== after.prices?.consumer) {
      parts.push(
        `소비자가 ${before.prices?.consumer ?? "-"} → ${after.prices?.consumer ?? "-"}`,
      );
    }
    if (before.status?.selling !== after.status?.selling) {
      parts.push(
        `판매 ${before.status?.selling ? "Y" : "N"} → ${after.status?.selling ? "Y" : "N"}`,
      );
    }
    if (before.status?.sold_out !== after.status?.sold_out) {
      parts.push(
        `품절 ${before.status?.sold_out ? "Y" : "N"} → ${after.status?.sold_out ? "Y" : "N"}`,
      );
    }
    if (parts.length) changed.push(`${shortName(after)}: ${parts.join(", ")}`);
  }

  if (!added.length && !removed.length && !changed.length) {
    console.log("  없음 (상품 동일)");
    return;
  }

  console.log(
    `  상품 ${Object.keys(prev).length} → ${next.product_count}`,
  );
  printChangeLines("+ 추가", added);
  printChangeLines("- 삭제", removed);
  printChangeLines("~ 변경", changed);
}

async function build(): Promise<void> {
  const env = readEnvFile();
  const mallId =
    process.env.CAFE24_MALL_ID ?? env.get("CAFE24_MALL_ID") ?? "icilamaison";
  const clientId = requireEnv(env, "CAFE24_CLIENT_ID");
  const clientSecret = requireEnv(env, "CAFE24_CLIENT_SECRET");
  const refreshToken = requireEnv(env, "CAFE24_REFRESH_TOKEN");

  const accessToken = await refreshAccessToken(
    mallId,
    clientId,
    clientSecret,
    refreshToken,
  );

  const previous = loadPreviousCatalog();
  const products = await fetchProducts(mallId, accessToken);
  const productNos = new Set(products.map((product) => product.product_no));
  const categoriesByProduct = await fetchCategoryAssignments(
    mallId,
    accessToken,
    productNos,
  );
  const { optionsByProduct, failed } = await fetchOptions(
    mallId,
    accessToken,
    products,
  );
  const benefitsByProduct = await fetchBenefits(mallId, accessToken);
  const mapped: Record<string, MappedProduct> = {};

  for (const product of products.sort((a, b) => a.product_no - b.product_no)) {
    if (product.display !== "T") continue;
    if (isExcludedName(product.product_name || "")) continue;

    const assigned = categoriesByProduct.get(product.product_no) || [];
    const categories = assigned.filter(
      (category) => !EXCLUDED_CATEGORY_NOS.has(category.category_no),
    );
    if (assigned.length && !categories.length) continue;

    mapped[String(product.product_no)] = {
      ...mapProduct(
        product,
        categories,
        optionsByProduct.get(product.product_no) || [],
      ),
      benefits: benefitsByProduct.get(product.product_no) || [],
    };
  }

  const catalog: Catalog = {
    generated_at: new Date().toISOString(),
    source: "cafe24-admin-api",
    product_count: Object.keys(mapped).length,
    option_fetch_failures: failed,
    products: mapped,
  };
  validateCatalog(catalog);

  try {
    writeFileSync(TEMP_PATH, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
    JSON.parse(readFileSync(TEMP_PATH, "utf8"));
    renameSync(TEMP_PATH, OUTPUT_PATH);
  } finally {
    if (existsSync(TEMP_PATH)) rmSync(TEMP_PATH);
  }

  catalogDiff(previous, catalog);
  console.log(`\n[산출물] all_product.json (${catalog.product_count}개, 옵션 실패 ${failed})`);
}

build().catch((error: unknown) => {
  console.error(
    `[build-all-products] 실패: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
