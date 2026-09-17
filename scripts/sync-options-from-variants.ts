/**
 * product.json의 색상·사이즈 목록과 사이즈별 판매가를 카페24 Admin API(variants)에 맞추는 스크립트.
 * API가 기준이다. API에 없는 옵션은 지우고, API에만 있는 옵션은 추가한다.
 *
 *   npx tsx scripts/sync-options-from-variants.ts           # dry-run
 *   npx tsx scripts/sync-options-from-variants.ts --write   # 반영
 *
 * 사이즈 판매가 = 상품 판매가(price) + 해당 사이즈 variant의 additional_amount.
 * 추가금은 음수일 수도 있다(기본가보다 싼 사이즈). 0일 때만 문자열로 둔다.
 *
 * 색상 hex는 API의 option_color가 비어 있으면 기존 값을 유지한다.
 * 카페24 관리자에 색상칩을 지정하지 않은 옵션이 많아서, 덮어쓰면 수기 값이 전부 날아간다.
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

type AxisValues = { order: string[]; addPrices: Map<string, number>; conflicts: string[] };

type ApiProduct = {
  product_no: number;
  variants?: Variant[];
};

type CatalogSizeOption = string | { name: string; salePrice?: number; components?: unknown[] };

type CatalogProduct = {
  productNo: number;
  productName: string;
  salePrice?: number;
  colors?: Record<string, string>;
  sizes?: CatalogSizeOption[];
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
  if (!value) throw new Error(`${key}가 없습니다. .env.local에 추가해주세요.`);
  return value;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 기존 키에 연속 공백이 섞인 경우가 있다("소프트블랙  SS"). 공백만 다르면 같은 옵션으로 본다.
function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
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

// 축(COLOR·SIZE) 값을 API 순서 그대로 모은다.
// 같은 사이즈가 색상마다 반복되므로 추가금이 갈리는지도 함께 본다. 갈리면 사이즈 단위로 정할 수 없다.
function collectAxis(variants: Variant[], axis: "COLOR" | "SIZE"): AxisValues {
  const order: string[] = [];
  const seen = new Map<string, Set<number>>();

  for (const variant of variants) {
    for (const option of variant.options ?? []) {
      if (option.name !== axis || !option.value) continue;

      const name = option.value.trim();
      if (!seen.has(name)) order.push(name);

      const amount = Number(variant.additional_amount ?? 0);
      const set = seen.get(name) ?? new Set<number>();
      set.add(Number.isNaN(amount) ? 0 : amount);
      seen.set(name, set);
    }
  }

  const addPrices = new Map<string, number>();
  const conflicts: string[] = [];

  for (const [name, amounts] of seen) {
    if (amounts.size > 1) {
      conflicts.push(`${name} (${[...amounts].join("/")})`);
      continue;
    }
    addPrices.set(name, [...amounts][0]);
  }

  return { order, addPrices, conflicts };
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
    // 세트 상품의 옵션은 구성품에 있다. variants로는 판단할 수 없다.
    if (product.components?.length) continue;

    const sizes = product.sizes ?? [];
    if (sizes.some((size) => typeof size === "object" && Array.isArray(size.components))) continue;

    const variants = variantsByProductNo.get(product.productNo);
    const basePrice = product.salePrice;
    if (!variants?.length || !basePrice) continue;

    const changes: string[] = [];
    const colorAxis = collectAxis(variants, "COLOR");
    const sizeAxis = collectAxis(variants, "SIZE");

    if (sizeAxis.conflicts.length > 0) {
      conflicted.push(`${product.productNo} ${product.productName}: ${sizeAxis.conflicts.join(", ")}`);
    }

    /* ---------- 색상 ---------- */
    if (colorAxis.order.length > 0) {
      const current = product.colors ?? {};
      const currentByNormalized = new Map(
        Object.entries(current).map(([key, hex]) => [normalizeSpace(key), hex]),
      );
      const nextColors: Record<string, string> = {};

      for (const name of colorAxis.order) {
        // hex는 API가 주지 않는 경우가 많다. 기존 값을 살린다.
        nextColors[name] = currentByNormalized.get(normalizeSpace(name)) ?? "";
      }

      const nextNormalized = new Set(colorAxis.order.map(normalizeSpace));
      const added = colorAxis.order.filter(
        (name) => !currentByNormalized.has(normalizeSpace(name)),
      );
      const removed = Object.keys(current).filter(
        (name) => !nextNormalized.has(normalizeSpace(name)),
      );

      if (added.length > 0 || removed.length > 0) {
        if (added.length > 0) changes.push(`색상 추가 ${added.join("/")}`);
        if (removed.length > 0) changes.push(`색상 삭제 ${removed.join("/")}`);
        product.colors = nextColors;
      }
    }

    /* ---------- 사이즈 ---------- */
    if (sizeAxis.order.length > 0) {
      const currentByName = new Map(
        sizes.map((size) => [normalizeSpace(getSizeOptionName(size)), size]),
      );
      const nextSizes: CatalogSizeOption[] = [];

      for (const name of sizeAxis.order) {
        const before = currentByName.get(normalizeSpace(name));
        const addPrice = sizeAxis.addPrices.get(name);

        // 추가금이 색상마다 갈리는 사이즈는 가격을 정할 수 없으니 기존 값을 그대로 둔다.
        if (addPrice === undefined) {
          nextSizes.push(before ?? name);
          continue;
        }

        const salePrice = basePrice + addPrice;
        const beforePrice = typeof before === "object" ? before.salePrice : undefined;

        if (addPrice === 0) {
          nextSizes.push(name);
          if (beforePrice != null) changes.push(`${name} ${beforePrice} → ${salePrice}`);
          continue;
        }

        nextSizes.push({ ...(typeof before === "object" ? before : {}), name, salePrice });
        if (beforePrice !== salePrice) {
          changes.push(`${name} ${beforePrice ?? basePrice} → ${salePrice}`);
        }
      }

      const nextSizeNames = new Set(sizeAxis.order.map(normalizeSpace));
      const added = sizeAxis.order.filter((name) => !currentByName.has(normalizeSpace(name)));
      const removed = [...currentByName.keys()].filter((name) => !nextSizeNames.has(name));
      if (added.length > 0) changes.push(`사이즈 추가 ${added.join("/")}`);
      if (removed.length > 0) changes.push(`사이즈 삭제 ${removed.join("/")}`);

      if (changes.length > 0) product.sizes = nextSizes;
    }

    if (changes.length > 0) {
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
