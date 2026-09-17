/**
 * 카페24 Admin API로 상품 목록·옵션을 받아오는 스크립트.
 * 토큰이 필요하다(scope: mall.read_product). 재고·가격 스크립트와 달리 공개 페이지 파싱이 아니다.
 *
 *   npx tsx scripts/sync-products-from-cafe24.ts          # 요약만 출력
 *   npx tsx scripts/sync-products-from-cafe24.ts --dump   # 원본 JSON 파일로 저장
 *
 * 필요한 값은 .env.local에 둔다(커밋 금지):
 *   CAFE24_MALL_ID=icilamaison
 *   CAFE24_CLIENT_ID=...
 *   CAFE24_CLIENT_SECRET=...
 *   CAFE24_REFRESH_TOKEN=...
 *
 * access_token은 2시간, refresh_token은 2주마다 만료되고 갱신 시 refresh_token도 새로 발급된다.
 * 그래서 갱신에 성공하면 .env.local의 CAFE24_REFRESH_TOKEN을 새 값으로 덮어쓴다.
 * 이 파일을 안 갱신하면 다음 실행이 실패한다.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ENV_PATH = path.join(process.cwd(), ".env.local");
const DUMP = process.argv.includes("--dump");
const DUMP_PATH = path.join(process.cwd(), "cafe24-products.json");

const PAGE_SIZE = 100;
// 카페24 API는 초당 요청 수 제한이 있다. 옵션 조회를 상품마다 돌리므로 간격을 둔다.
const REQUEST_INTERVAL_MS = 120;

type Cafe24Product = {
  product_no: number;
  product_code: string;
  custom_product_code?: string;
  product_name: string;
  price?: string;
  retail_price?: string;
  supply_price?: string;
  selling?: string;
  display?: string;
};

type Cafe24OptionValue = {
  option_text?: string;
  option_value?: string;
};

type Cafe24Option = {
  option_name?: string;
  option_value?: Cafe24OptionValue[];
};

type Cafe24BundleComponent = {
  product_no: number;
  product_name: string;
  product_code: string;
  product_price?: string;
  purchase_quantity?: number;
};

type Cafe24BundleProduct = {
  product_no: number;
  product_code: string;
  product_name: string;
  bundle_product_components?: Cafe24BundleComponent[];
};

function readEnvFile(): Map<string, string> {
  const map = new Map<string, string>();

  if (!existsSync(ENV_PATH)) {
    return map;
  }

  for (const line of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index === -1) continue;

    map.set(trimmed.slice(0, index).trim(), trimmed.slice(index + 1).trim());
  }

  return map;
}

// 값 하나만 교체. 기존 줄 순서·주석을 보존하기 위해 파일 전체를 다시 쓰지 않는다.
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
    throw new Error(
      `${key}가 없습니다. .env.local에 추가해주세요. (파일: ${ENV_PATH})`,
    );
  }

  return value;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function refreshAccessToken(
  mallId: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );

  const response = await fetch(
    `https://${mallId}.cafe24api.com/api/v2/oauth/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    },
  );

  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `토큰 갱신 실패 (${response.status}). refresh_token이 만료됐다면 카페24에서 다시 발급해야 합니다.\n${body}`,
    );
  }

  const data = JSON.parse(body) as {
    access_token: string;
    refresh_token: string;
    expires_at?: string;
  };

  // refresh_token은 갱신 때마다 새 값이 나온다. 저장하지 않으면 다음 실행이 실패한다.
  updateEnvValue("CAFE24_REFRESH_TOKEN", data.refresh_token);
  console.log(
    `[token] 갱신 완료 (access_token 만료: ${data.expires_at ?? "미표기"})`,
  );
  console.log("[token] 새 refresh_token을 .env.local에 저장했습니다.");

  return data.access_token;
}

async function apiGet<T>(
  mallId: string,
  accessToken: string,
  pathname: string,
): Promise<T> {
  const response = await fetch(
    `https://${mallId}.cafe24api.com/api/v2/admin/${pathname}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`GET ${pathname} 실패 (${response.status})\n${body}`);
  }

  return JSON.parse(body) as T;
}

async function fetchAllProducts(
  mallId: string,
  accessToken: string,
): Promise<Cafe24Product[]> {
  const products: Cafe24Product[] = [];
  let offset = 0;

  for (;;) {
    const data = await apiGet<{ products: Cafe24Product[] }>(
      mallId,
      accessToken,
      `products?limit=${PAGE_SIZE}&offset=${offset}`,
    );

    products.push(...data.products);
    console.log(`[products] ${products.length}건 수집`);

    if (data.products.length < PAGE_SIZE) break;

    offset += PAGE_SIZE;
    await wait(REQUEST_INTERVAL_MS);
  }

  return products;
}

// 세트(묶음)상품은 products에서 set_product_type="C"로만 표시되고 구성품이 없다.
// 구성품은 bundleproducts 전용 엔드포인트에서만 온다. products/{no}/options는 422로 거부한다.
async function fetchAllBundleProducts(
  mallId: string,
  accessToken: string,
): Promise<Cafe24BundleProduct[]> {
  const bundles: Cafe24BundleProduct[] = [];
  let offset = 0;

  for (;;) {
    const data = await apiGet<{ bundleproducts: Cafe24BundleProduct[] }>(
      mallId,
      accessToken,
      `bundleproducts?limit=${PAGE_SIZE}&offset=${offset}`,
    );

    bundles.push(...data.bundleproducts);
    console.log(`[bundles] ${bundles.length}건 수집`);

    if (data.bundleproducts.length < PAGE_SIZE) break;

    offset += PAGE_SIZE;
    await wait(REQUEST_INTERVAL_MS);
  }

  return bundles;
}

async function fetchOptions(
  mallId: string,
  accessToken: string,
  productNo: number,
): Promise<Cafe24Option[]> {
  try {
    const data = await apiGet<{ option: { options?: Cafe24Option[] } }>(
      mallId,
      accessToken,
      `products/${productNo}/options`,
    );

    return data.option?.options ?? [];
  } catch {
    // 옵션 없는 상품은 404가 난다. 수집 자체를 멈출 이유는 아니다.
    return [];
  }
}

async function main(): Promise<void> {
  const env = readEnvFile();
  const mallId = process.env.CAFE24_MALL_ID ?? env.get("CAFE24_MALL_ID") ?? "icilamaison";
  const clientId = requireEnv(env, "CAFE24_CLIENT_ID");
  const clientSecret = requireEnv(env, "CAFE24_CLIENT_SECRET");
  const refreshToken = requireEnv(env, "CAFE24_REFRESH_TOKEN");

  const accessToken = await refreshAccessToken(
    mallId,
    clientId,
    clientSecret,
    refreshToken,
  );

  const products = await fetchAllProducts(mallId, accessToken);
  const bundles = await fetchAllBundleProducts(mallId, accessToken);
  const componentsByProductNo = new Map(
    bundles.map((bundle) => [
      bundle.product_no,
      bundle.bundle_product_components ?? [],
    ]),
  );

  const withOptions: Array<
    Cafe24Product & {
      options: Cafe24Option[];
      bundleComponents: Cafe24BundleComponent[];
    }
  > = [];

  for (const product of products) {
    const bundleComponents = componentsByProductNo.get(product.product_no);

    withOptions.push({
      ...product,
      // 세트 상품은 옵션 조회가 422로 막히므로 요청 자체를 건너뛴다.
      options: bundleComponents
        ? []
        : await fetchOptions(mallId, accessToken, product.product_no),
      bundleComponents: bundleComponents ?? [],
    });

    if (!bundleComponents) {
      await wait(REQUEST_INTERVAL_MS);
    }
  }

  const setProducts = withOptions.filter(
    (product) => product.bundleComponents.length > 0,
  );
  const componentCount = setProducts.reduce(
    (total, product) => total + product.bundleComponents.length,
    0,
  );

  console.log(
    `\n[요약] 상품 ${withOptions.length}건 (세트 ${setProducts.length}건 / 구성품 ${componentCount}개)`,
  );

  for (const product of withOptions.slice(0, 5)) {
    const optionNames = product.options
      .map((option) => option.option_name)
      .filter(Boolean)
      .join(", ");

    console.log(
      `- ${product.product_no} ${product.product_name} / 판매가 ${product.price ?? "-"} / 옵션: ${optionNames || "없음"}`,
    );
  }

  if (withOptions.length > 5) {
    console.log(`  ... 외 ${withOptions.length - 5}건`);
  }

  if (DUMP) {
    writeFileSync(DUMP_PATH, JSON.stringify(withOptions, null, 2), "utf8");
    console.log(`\n[dump] ${DUMP_PATH}`);
  } else {
    console.log("\n원본을 파일로 받으려면 --dump 옵션을 붙여주세요.");
  }
}

main().catch((error: unknown) => {
  console.error(
    `[sync] 실패: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
