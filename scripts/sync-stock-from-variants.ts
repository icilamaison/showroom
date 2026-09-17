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
 * .env.local 값은 sync-products-from-cafe24.ts와 같다(scope: mall.read_product).
 * refresh_token은 갱신 때마다 새로 발급되므로 성공하면 .env.local을 덮어쓴다.
 *
 * 세트(구성품) 상품은 variants가 구성품 재고를 반영하지 않아 제외한다.
 * 그쪽은 sync-stock-from-cafe24.ts의 set_option_data 경로를 그대로 쓴다.
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
  if (!value) {
    throw new Error(`${key}가 없습니다. .env.local에 추가해주세요. (파일: ${ENV_PATH})`);
  }
  return value;
}

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
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `토큰 갱신 실패 (${response.status}). refresh_token이 만료됐다면 카페24에서 다시 발급해야 합니다.\n${body}`,
    );
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

async function main(): Promise<void> {
  const env = readEnvFile();
  const mallId = process.env.CAFE24_MALL_ID ?? env.get("CAFE24_MALL_ID") ?? "icilamaison";
  const accessToken = await refreshAccessToken(
    mallId,
    requireEnv(env, "CAFE24_CLIENT_ID"),
    requireEnv(env, "CAFE24_CLIENT_SECRET"),
    requireEnv(env, "CAFE24_REFRESH_TOKEN"),
  );

  const products = await fetchAllProducts(mallId, accessToken);
  const variantsByProductNo = new Map(
    products.map((product) => [product.product_no, product.variants ?? []]),
  );

  const catalog = JSON.parse(readFileSync(JSON_PATH, "utf8")) as CatalogProduct[];
  let updated = 0;
  let skipped = 0;
  let missing = 0;

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

    const changes: string[] = [];

    if (colorNames.length > 0) {
      const soldOut = findSoldOutNames(variants, "COLOR", colorNames);
      if (applyIfChanged(product, "soldOutColors", soldOut)) {
        changes.push(`soldOutColors → ${JSON.stringify(soldOut)}`);
      }
    }

    if (sizeNames.length > 0) {
      const soldOut = findSoldOutNames(variants, "SIZE", sizeNames);
      if (applyIfChanged(product, "soldOutSizes", soldOut)) {
        changes.push(`soldOutSizes → ${JSON.stringify(soldOut)}`);
      }
    }

    if (changes.length > 0) {
      updated += 1;
      console.log(`● ${product.productName} (${product.productNo}): ${changes.join(" / ")}`);
    }
  }

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
