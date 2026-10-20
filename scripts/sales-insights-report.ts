/**
 * 카페24 판매수량 통계로 기간별 잘 팔린 상품 인사이트 마크다운을 만든다.
 *
 * 필요 scope: mall.read_product, mall.read_salesreport
 * salesvolume 은 상품번호가 필수라, 상품 목록을 받은 뒤 묶어서 조회한다.
 *
 *   npx tsx scripts/sales-insights-report.ts
 *   npx tsx scripts/sales-insights-report.ts --days 7
 *   npx tsx scripts/sales-insights-report.ts --from 2026-10-01 --to 2026-10-07
 *   npx tsx scripts/sales-insights-report.ts --no-compare
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getAccessToken, loadCafe24Config } from "./lib/cafe24-auth";

const ROOT = process.cwd();
const API_VERSION = "2026-03-01";
const REQUEST_INTERVAL_MS = 150;
const REQUEST_TIMEOUT_MS = 45_000;
const PAGE_SIZE = 100;
const PRODUCT_CHUNK = 40;
const DEFAULT_DAYS = 7;
const TOP_N = 15;
const REQUIRED_SCOPE = "mall.read_salesreport";

type Cafe24SalesRow = {
  shop_no?: number;
  product_no?: number;
  product_code?: string;
  product_name?: string;
  variants_code?: string;
  product_price?: string | number;
  product_option_price?: string | number;
  settle_count?: string | number;
  total_sales?: string | number;
  collection_date?: string;
  collection_hour?: string;
};

type ProductRef = {
  productNo: number;
  productCode: string;
  productName: string;
};

type CatalogMeta = {
  category: string;
  internalCode: string;
  productName: string;
};

type ProductAgg = {
  productNo: number;
  productCode: string;
  name: string;
  category: string;
  family: string;
  quantity: number;
  revenue: number;
  orders: number;
};

type DateRange = { from: string; to: string };

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function kstToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date(),
  );
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day) + days * 86_400_000;
  return new Date(utc).toISOString().slice(0, 10);
}

function inclusiveDays(range: DateRange): number {
  const from = Date.parse(`${range.from}T00:00:00Z`);
  const to = Date.parse(`${range.to}T00:00:00Z`);
  return Math.floor((to - from) / 86_400_000) + 1;
}

function previousRange(range: DateRange): DateRange {
  const days = inclusiveDays(range);
  return {
    from: addDays(range.from, -days),
    to: addDays(range.from, -1),
  };
}

function defaultRange(days: number): DateRange {
  const yesterday = addDays(kstToday(), -1);
  return { from: addDays(yesterday, -(days - 1)), to: yesterday };
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatMoney(value: number): string {
  if (Math.abs(value) >= 10_000) {
    return `${Math.round(value / 10_000).toLocaleString("ko-KR")}만원`;
  }
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function formatQty(value: number): string {
  return `${Math.round(value).toLocaleString("ko-KR")}개`;
}

function formatPct(current: number, previous: number): string {
  if (previous <= 0) return current > 0 ? "신규" : "-";
  const pct = ((current - previous) / previous) * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}%`;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadCatalogIndex(): Map<number, CatalogMeta> {
  const catalogPath = path.join(ROOT, "product.json");
  if (!existsSync(catalogPath)) return new Map();

  const products = JSON.parse(readFileSync(catalogPath, "utf8")) as Array<{
    productNo?: number;
    category?: string;
    internalCode?: string;
    productName?: string;
  }>;

  return new Map(
    products
      .filter((product) => typeof product.productNo === "number")
      .map((product) => [
        product.productNo as number,
        {
          category: product.category?.trim() || "(미분류)",
          internalCode: product.internalCode?.trim() || "",
          productName: product.productName?.trim() || "",
        },
      ]),
  );
}

function scopeHelp(): string {
  return [
    `${REQUIRED_SCOPE} 권한이 없습니다.`,
    "1) Cafe24 개발자센터 앱에 mall.read_salesreport 추가",
    "2) 아래처럼 재인증 (기존 카탈로그 scope에 매출을 붙인다)",
    "   CAFE24_SCOPE=mall.read_product,mall.read_category,mall.read_promotion,mall.read_salesreport \\",
    "     npx tsx scripts/cafe24-auth.ts auth",
    "3) npx tsx scripts/cafe24-auth.ts init CODE",
    "4) CI면 CAFE24_PUSH_SECRET=1 npx tsx scripts/cafe24-auth.ts push-secret",
  ].join("\n");
}

async function apiGet(
  mallId: string,
  accessToken: string,
  pathname: string,
  attempt = 0,
): Promise<unknown> {
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
    const delay =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 1000 * (attempt + 1);
    console.error(
      `API ${response.status}, ${delay}ms 후 재시도 ${attempt + 1}/6: ${pathname}`,
    );
    await wait(delay);
    return apiGet(mallId, accessToken, pathname, attempt + 1);
  }

  if (!response.ok) {
    const lower = text.toLowerCase();
    if (
      response.status === 403 ||
      lower.includes("scope") ||
      lower.includes("권한")
    ) {
      throw new Error(`${scopeHelp()}\n\n원본: HTTP ${response.status} ${text.slice(0, 400)}`);
    }
    throw new Error(`GET ${pathname} 실패 (${response.status})\n${text.slice(0, 400)}`);
  }

  return JSON.parse(text) as unknown;
}

function rowQuantity(row: Cafe24SalesRow): number {
  return toNumber(row.total_sales);
}

function rowRevenue(row: Cafe24SalesRow): number {
  return (
    (toNumber(row.product_price) + toNumber(row.product_option_price)) *
    rowQuantity(row)
  );
}

function rowOrders(row: Cafe24SalesRow): number {
  return toNumber(row.settle_count);
}

async function fetchProductRefs(
  mallId: string,
  accessToken: string,
): Promise<ProductRef[]> {
  const refs: ProductRef[] = [];
  let offset = 0;

  for (;;) {
    const data = (await apiGet(
      mallId,
      accessToken,
      `products?limit=${PAGE_SIZE}&offset=${offset}&fields=product_no,product_code,product_name`,
    )) as {
      products?: Array<{
        product_no?: number;
        product_code?: string;
        product_name?: string;
      }>;
    };
    const page = data.products ?? [];
    for (const product of page) {
      const productNo = toNumber(product.product_no);
      if (!productNo) continue;
      refs.push({
        productNo,
        productCode: product.product_code ?? "",
        productName: product.product_name ?? `#${productNo}`,
      });
    }
    console.log(`[products] ${refs.length}건 수집`);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    await wait(REQUEST_INTERVAL_MS);
  }

  return refs;
}

async function fetchSalesvolume(
  mallId: string,
  accessToken: string,
  range: DateRange,
  productNos: number[],
): Promise<Cafe24SalesRow[]> {
  const rows: Cafe24SalesRow[] = [];

  for (let index = 0; index < productNos.length; index += PRODUCT_CHUNK) {
    const chunk = productNos.slice(index, index + PRODUCT_CHUNK);
    let offset = 0;

    for (;;) {
      const query = new URLSearchParams({
        start_date: range.from,
        end_date: range.to,
        product_no: chunk.join(","),
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      const data = (await apiGet(
        mallId,
        accessToken,
        `reports/salesvolume?${query.toString()}`,
      )) as { salesvolume?: Cafe24SalesRow[] | null };

      const page = data.salesvolume ?? [];
      rows.push(...page);

      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
      await wait(REQUEST_INTERVAL_MS);
    }

    const done = Math.min(index + PRODUCT_CHUNK, productNos.length);
    console.log(
      `[salesvolume] ${range.from}~${range.to} 상품 ${done}/${productNos.length} · 행 ${rows.length}`,
    );
    await wait(REQUEST_INTERVAL_MS);
  }

  return rows;
}

function aggregateProducts(
  rows: Cafe24SalesRow[],
  catalog: Map<number, CatalogMeta>,
  products: Map<number, ProductRef>,
): ProductAgg[] {
  const byProduct = new Map<number, ProductAgg>();

  for (const row of rows) {
    const productNo = toNumber(row.product_no);
    if (!productNo) continue;

    const meta = catalog.get(productNo);
    const ref = products.get(productNo);
    const current = byProduct.get(productNo) ?? {
      productNo,
      productCode: ref?.productCode ?? row.product_code ?? "",
      name:
        meta?.productName ||
        ref?.productName ||
        row.product_name ||
        `#${productNo}`,
      category: meta?.category || "(카탈로그 외)",
      family: meta?.internalCode || "",
      quantity: 0,
      revenue: 0,
      orders: 0,
    };

    current.quantity += rowQuantity(row);
    current.revenue += rowRevenue(row);
    current.orders += rowOrders(row);
    byProduct.set(productNo, current);
  }

  return [...byProduct.values()].filter(
    (product) => product.quantity > 0 || product.revenue > 0,
  );
}

function totalsOf(products: ProductAgg[]): {
  quantity: number;
  revenue: number;
  orders: number;
} {
  return products.reduce(
    (acc, product) => {
      acc.quantity += product.quantity;
      acc.revenue += product.revenue;
      acc.orders += product.orders;
      return acc;
    },
    { quantity: 0, revenue: 0, orders: 0 },
  );
}

function rankBy<K extends "quantity" | "revenue">(
  products: ProductAgg[],
  key: K,
  limit = TOP_N,
): ProductAgg[] {
  return [...products].sort((a, b) => b[key] - a[key]).slice(0, limit);
}

function groupSum(
  products: ProductAgg[],
  key: "category" | "family",
): Array<{ name: string; quantity: number; revenue: number }> {
  const grouped = new Map<string, { quantity: number; revenue: number }>();
  for (const product of products) {
    const name = product[key].trim() || "(없음)";
    const current = grouped.get(name) ?? { quantity: 0, revenue: 0 };
    current.quantity += product.quantity;
    current.revenue += product.revenue;
    grouped.set(name, current);
  }
  return [...grouped.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.revenue - a.revenue);
}

function withPrevious(
  current: ProductAgg[],
  previous: ProductAgg[],
): Array<ProductAgg & { prevQuantity: number; prevRevenue: number; pct: number }> {
  const prevByNo = new Map(previous.map((product) => [product.productNo, product]));
  return current.map((product) => {
    const prev = prevByNo.get(product.productNo);
    const prevQuantity = prev?.quantity ?? 0;
    const prevRevenue = prev?.revenue ?? 0;
    const pct =
      prevQuantity > 0 ? ((product.quantity - prevQuantity) / prevQuantity) * 100 : 0;
    return { ...product, prevQuantity, prevRevenue, pct };
  });
}

type Compared = ProductAgg & {
  prevQuantity: number;
  prevRevenue: number;
  pct: number;
};

function isCampaign(product: ProductAgg): boolean {
  return /공동구매|스와차/.test(product.name);
}

function isNoise(product: ProductAgg): boolean {
  return /샘플|스와치|사은품/.test(product.name);
}

function isCore(product: ProductAgg): boolean {
  return !isCampaign(product) && !isNoise(product);
}

function aov(quantity: number, revenue: number): number {
  return quantity > 0 ? revenue / quantity : 0;
}

function namedCategory(
  current: ProductAgg[],
): { name: string; quantity: number; revenue: number } | undefined {
  return groupSum(current, "category").find(
    (row) => row.name && !row.name.startsWith("("),
  );
}

function pick<T>(items: T[], count: number): T[] {
  return items.slice(0, count);
}

function movers(
  current: ProductAgg[],
  previous: ProductAgg[],
  direction: "up" | "down",
): Compared[] {
  const scored = withPrevious(current, previous)
    .map((row) => ({
      ...row,
      deltaRevenue: row.revenue - row.prevRevenue,
    }))
    .filter((row) => {
      if (direction === "up") {
        return (
          row.prevQuantity >= 1 &&
          row.quantity > row.prevQuantity &&
          row.deltaRevenue > 0
        );
      }
      return (
        row.prevQuantity >= 2 &&
        row.quantity < row.prevQuantity &&
        row.deltaRevenue < 0
      );
    });
  scored.sort((a, b) =>
    direction === "up"
      ? b.deltaRevenue - a.deltaRevenue
      : a.deltaRevenue - b.deltaRevenue,
  );
  return scored;
}

function newHighTicket(
  current: ProductAgg[],
  previous: ProductAgg[],
): ProductAgg[] {
  const prevNos = new Set(previous.map((product) => product.productNo));
  return [...current]
    .filter(
      (product) =>
        !prevNos.has(product.productNo) &&
        (product.revenue >= 1_000_000 || aov(product.quantity, product.revenue) >= 300_000),
    )
    .sort((a, b) => b.revenue - a.revenue);
}

function shortPeriod(range: DateRange): string {
  return `${range.from} ~ ${range.to.slice(5)}`;
}

function vsLabel(range: DateRange, hasPrevious: boolean): string {
  if (!hasPrevious) return "";
  const days = inclusiveDays(range);
  return days === 7 ? "직전 주 대비" : `직전 ${days}일 대비`;
}

function insightLines(
  current: ProductAgg[],
  previous: ProductAgg[] | null,
): string[] {
  const totals = totalsOf(current);
  const prevTotals = previous ? totalsOf(previous) : null;
  const campaign = current.filter(isCampaign);
  const prevCampaign = previous?.filter(isCampaign) ?? [];
  const core = current.filter(isCore);
  const prevCore = previous?.filter(isCore) ?? [];
  const campaignTotals = totalsOf(campaign);
  const prevCampaignTotals = totalsOf(prevCampaign);
  const coreTotals = totalsOf(core);
  const prevCoreTotals = totalsOf(prevCore);
  const topQty = rankBy(current, "quantity", 1)[0];
  const topRev = rankBy(current, "revenue", 1)[0];
  const topCoreRev = rankBy(core, "revenue", 1)[0];
  const category = namedCategory(current);
  const acc = groupSum(current, "category").find((row) => row.name === "ACC");
  const lines: string[] = [];

  if (prevTotals && totals.quantity > 0 && prevTotals.quantity > 0) {
    const currentAov = aov(totals.quantity, totals.revenue);
    const prevAov = aov(prevTotals.quantity, prevTotals.revenue);
    const revPct = (totals.revenue - prevTotals.revenue) / prevTotals.revenue;
    const qtyPct = (totals.quantity - prevTotals.quantity) / prevTotals.quantity;
    if (revPct - qtyPct >= 0.05) {
      lines.push(
        `매출이 수량보다 더 올랐다. 객단가 ${formatMoney(prevAov)} → ${formatMoney(currentAov)}.`,
      );
    } else if (qtyPct - revPct >= 0.05) {
      lines.push(
        `수량은 늘었는데 매출은 덜 따라왔다. 객단가 ${formatMoney(prevAov)} → ${formatMoney(currentAov)}. 저단가·부자재 비중을 볼 일.`,
      );
    }
  }

  if (previous && campaign.length + prevCampaign.length > 0) {
    const campaignDown =
      prevCampaignTotals.quantity > 0 &&
      campaignTotals.quantity < prevCampaignTotals.quantity;
    const coreUp = coreTotals.revenue > prevCoreTotals.revenue;
    if (campaignDown && coreUp) {
      lines.push(
        `공동구매 수량은 ${formatQty(prevCampaignTotals.quantity)} → ${formatQty(campaignTotals.quantity)}로 줄었는데, 본상품 매출이 ${formatMoney(prevCoreTotals.revenue)} → ${formatMoney(coreTotals.revenue)}으로 받쳤다.`,
      );
    } else if (!campaignDown && campaignTotals.revenue > 0 && totals.revenue > 0) {
      const share = (campaignTotals.revenue / totals.revenue) * 100;
      lines.push(
        `공동구매가 매출의 ${share.toFixed(1)}% (${formatMoney(campaignTotals.revenue)}, ${formatQty(campaignTotals.quantity)}).`,
      );
    }
  }

  if (topQty && topRev) {
    if (isCampaign(topRev) && topCoreRev) {
      lines.push(
        `매출 1위는 ${topRev.name} ${formatQty(topRev.quantity)}/${formatMoney(topRev.revenue)}. 본상품은 ${topCoreRev.name} ${formatQty(topCoreRev.quantity)}/${formatMoney(topCoreRev.revenue)}.`,
      );
    } else if (topQty.productNo !== topRev.productNo) {
      lines.push(
        `많이 팔린 건 ${topQty.name} ${formatQty(topQty.quantity)}이고, 돈은 ${topRev.name} ${formatQty(topRev.quantity)}/${formatMoney(topRev.revenue)} 쪽에서 나왔다.`,
      );
    } else {
      lines.push(
        `수량·매출 모두 ${topQty.name} — ${formatQty(topQty.quantity)}, ${formatMoney(topQty.revenue)}.`,
      );
    }
  }

  if (category && totals.revenue > 0) {
    const share = (category.revenue / totals.revenue) * 100;
    let line = `카테고리는 ${category.name}가 매출의 ${share.toFixed(1)}%.`;
    if (
      acc &&
      totals.quantity > 0 &&
      acc.quantity / totals.quantity >= 0.2 &&
      acc.revenue / totals.revenue < 0.1
    ) {
      line += ` ACC는 수량 ${((acc.quantity / totals.quantity) * 100).toFixed(0)}%인데 매출은 ${((acc.revenue / totals.revenue) * 100).toFixed(1)}%라 수량 순위에서 본상품이 가려질 수 있다.`;
    }
    lines.push(line);
  }

  if (previous) {
    const up = pick(
      movers(core.length > 0 ? core : current, previous, "up"),
      2,
    );
    const down = pick(
      movers(current, previous, "down"),
      2,
    );
    if (up.length > 0) {
      lines.push(
        `오른 것: ${up
          .map(
            (row) =>
              `${row.name} ${formatQty(row.prevQuantity)} → ${formatQty(row.quantity)} (${formatMoney(row.revenue)})`,
          )
          .join(", ")}.`,
      );
    }
    if (down.length > 0) {
      lines.push(
        `빠진 것: ${down
          .map(
            (row) =>
              `${row.name} ${formatQty(row.prevQuantity)} → ${formatQty(row.quantity)} (${formatPct(row.quantity, row.prevQuantity)})`,
          )
          .join(", ")}.`,
      );
    }
    const fresh = pick(newHighTicket(current, previous), 2);
    if (fresh.length > 0) {
      lines.push(
        `이번 기간 새로 보인 고단가: ${fresh
          .map((row) => `${row.name} ${formatQty(row.quantity)}/${formatMoney(row.revenue)}`)
          .join(", ")}.`,
      );
    }
  }

  return lines;
}

function buildReport(input: {
  range: DateRange;
  current: ProductAgg[];
  previous: ProductAgg[] | null;
  runUrl?: string;
}): string {
  const { range, current, previous, runUrl } = input;
  if (current.length === 0) {
    return `${shortPeriod(range)}\n\n이 기간에 판매 데이터가 없습니다.\n`;
  }

  const totals = totalsOf(current);
  const prevTotals = previous ? totalsOf(previous) : null;
  const vs = vsLabel(range, Boolean(prevTotals));
  const currentAov = aov(totals.quantity, totals.revenue);
  const insights = insightLines(current, previous);
  const topRevenue = rankBy(current, "revenue", 5);

  const header = [
    vs ? `${shortPeriod(range)} (${vs})` : shortPeriod(range),
    "",
    prevTotals
      ? `매출 ${formatMoney(totals.revenue)} (${formatPct(totals.revenue, prevTotals.revenue)}) · 수량 ${formatQty(totals.quantity)} (${formatPct(totals.quantity, prevTotals.quantity)}) · 객단가 ${formatMoney(currentAov)}`
      : `매출 ${formatMoney(totals.revenue)} · 수량 ${formatQty(totals.quantity)} · 객단가 ${formatMoney(currentAov)}`,
  ];

  const lines = [...header, "", "왜", ...insights.map((line) => `- ${line}`)];

  if (topRevenue.length > 0) {
    lines.push(
      "",
      "매출 TOP",
      ...topRevenue.map(
        (row, index) =>
          `${index + 1}. ${row.name} — ${formatQty(row.quantity)} / ${formatMoney(row.revenue)}`,
      ),
    );
  }

  if (runUrl) {
    lines.push("", `실행 보기: ${runUrl}`);
  }

  return `${lines.join("\n")}\n`;
}

function parseArgs(): {
  range: DateRange;
  compare: boolean;
  outDir: string;
  dump: boolean;
  fromDump?: string;
} {
  const days = Number(argValue("--days") ?? process.env.SALES_DAYS ?? DEFAULT_DAYS);
  if (!Number.isInteger(days) || days < 1 || days > 90) {
    throw new Error("--days 는 1~90 정수여야 합니다.");
  }

  const from = argValue("--from") ?? process.env.SALES_FROM;
  const to = argValue("--to") ?? process.env.SALES_TO;
  const range =
    from && to
      ? { from, to }
      : from || to
        ? (() => {
            throw new Error("--from 과 --to 는 같이 써야 합니다.");
          })()
        : defaultRange(days);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(range.from) || !/^\d{4}-\d{2}-\d{2}$/.test(range.to)) {
    throw new Error("날짜는 YYYY-MM-DD 형식이어야 합니다.");
  }
  if (range.from > range.to) {
    throw new Error("시작일이 종료일보다 늦습니다.");
  }

  const compareEnv = process.env.SALES_COMPARE;
  const compare =
    !hasFlag("--no-compare") &&
    compareEnv !== "false" &&
    compareEnv !== "0";

  return {
    range,
    compare,
    outDir: argValue("--out") ?? path.join(ROOT, "artifacts/sales-insights"),
    dump: hasFlag("--dump"),
    fromDump: argValue("--from-dump"),
  };
}

async function main(): Promise<void> {
  const { range, compare, outDir, dump, fromDump } = parseArgs();
  const { mallId } = loadCafe24Config();
  const accessToken = await getAccessToken();
  const catalog = loadCatalogIndex();
  let compareRange = compare ? previousRange(range) : null;
  let reportRange = range;

  console.log(
    `[sales] ${range.from}~${range.to}` +
      (compareRange ? ` (비교 ${compareRange.from}~${compareRange.to})` : ""),
  );

  const productRefs = await fetchProductRefs(mallId, accessToken);
  const products = new Map(
    productRefs.map((product) => [product.productNo, product]),
  );
  const productNos = productRefs.map((product) => product.productNo);

  let currentRows: Cafe24SalesRow[];
  let previousRows: Cafe24SalesRow[];

  if (fromDump) {
    const dump = JSON.parse(readFileSync(fromDump, "utf8")) as {
      range?: DateRange;
      compareRange?: DateRange | null;
      currentRows?: Cafe24SalesRow[];
      previousRows?: Cafe24SalesRow[];
    };
    currentRows = dump.currentRows ?? [];
    previousRows = dump.previousRows ?? [];
    if (dump.range) reportRange = dump.range;
    compareRange = dump.compareRange ?? null;
    console.log(`[sales] dump에서 행 ${currentRows.length} + ${previousRows.length}`);
  } else {
    console.log(`[sales] 상품 ${productNos.length}개에 대해 판매수량을 조회합니다.`);
    currentRows = await fetchSalesvolume(mallId, accessToken, range, productNos);
    previousRows = compareRange
      ? await fetchSalesvolume(mallId, accessToken, compareRange, productNos)
      : [];
  }

  const current = aggregateProducts(currentRows, catalog, products);
  const previous = compareRange
    ? aggregateProducts(previousRows, catalog, products)
    : null;

  mkdirSync(outDir, { recursive: true });
  const report = buildReport({
    range: reportRange,
    current,
    previous,
    runUrl: process.env.RUN_URL ?? "",
  });

  const summaryPath = path.join(outDir, "summary.md");
  const mailPath = path.join(outDir, "mail.txt");
  writeFileSync(summaryPath, report, "utf8");
  writeFileSync(mailPath, report, "utf8");

  if (dump) {
    writeFileSync(
      path.join(outDir, "salesvolume.json"),
      `${JSON.stringify({ range, compareRange, currentRows, previousRows }, null, 2)}\n`,
      "utf8",
    );
  }

  const totals = totalsOf(current);
  console.log(
    `[요약] 상품 ${current.length}개 / 수량 ${formatQty(totals.quantity)} / 매출 ${formatMoney(totals.revenue)}`,
  );
  console.log(`[out] ${summaryPath}`);
  console.log(`[out] ${mailPath}`);
}

main().catch((error: unknown) => {
  console.error(
    `[sales] 실패: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
