/**
 * sync-products-from-cafe24.ts --dump이 만든 cafe24-products.json을 product.json에 머지한다.
 * API가 주는 값만 덮어쓴다: 상품명, 가격 4종, 색상 옵션 키.
 *
 *   npx tsx scripts/merge-cafe24-dump.ts            # dry-run (변경 내역만 출력)
 *   npx tsx scripts/merge-cafe24-dump.ts --write    # product.json 반영
 *
 * 건드리지 않는 값(API에 없거나 다른 스크립트 담당):
 *   internalCode / category  — 수작업 분류. API의 internal_product_name과 값이 다르다.
 *   colors의 hex             — 기존 값 보존. 새 옵션만 빈 문자열로 추가하고 목록을 출력한다.
 *   colorPrices              — 덤프의 additional_amount가 전부 null. sync-product-size-prices.ts 담당.
 *   soldOutColors            — sync-stock-from-cafe24.ts 담당.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const WRITE = process.argv.includes("--write");
const ADD_NEW = process.argv.includes("--add-new");

// 진열·판매중인데 카탈로그에 없는 상품을 추가할 때, 판매 상품이 아닌 것은 걸러낸다.
const SKIP_NAME_PATTERN = /사은품|샘플/;

type DumpOption = {
  option_name?: string;
  option_value?: { option_text?: string; option_color?: string }[];
};

type DumpProduct = {
  product_no: number;
  product_code: string;
  product_name: string;
  display?: string;
  selling?: string;
  price?: string;
  retail_price?: string;
  price_excluding_tax?: string;
  supply_price?: string;
  options?: DumpOption[];
  bundleComponents?: DumpBundleComponent[];
};

type DumpBundleComponent = {
  product_no: number;
  product_name: string;
  product_code: string;
  purchase_quantity?: number;
};

type CatalogComponent = {
  productCode?: string;
  name: string;
  quantity?: number;
  colors?: string[];
};

type CatalogProduct = {
  productCode?: string;
  internalCode?: string;
  category?: string;
  productNo: number;
  productName: string;
  consumerPrice?: number;
  salePrice?: number;
  productPrice?: number;
  supplyPrice?: number;
  components?: CatalogComponent[];
  sizes?: (string | { name: string })[];
  colors?: Record<string, string>;
};

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

// 옵션 그룹은 TYPE·COLOR·SIZE가 섞여 온다. 그룹이 하나뿐이면 이름이 달라도 그게 색상 그룹이다.
// 단 SIZE만 있는 상품(매트·블랭킷)은 색상이 아니라 sizes로 관리한다.
function findColorGroup(options: DumpOption[] | undefined): DumpOption | undefined {
  const color = options?.find((option) => option.option_name === "COLOR");
  if (color) return color;
  if (options?.length !== 1 || options[0].option_name === "SIZE") return undefined;
  return options[0];
}

function findSizeGroup(options: DumpOption[] | undefined): DumpOption | undefined {
  return options?.find((option) => option.option_name === "SIZE");
}

function optionTextsOf(group: DumpOption | undefined): string[] {
  return (group?.option_value ?? [])
    .map((value) => value.option_text)
    .filter((text): text is string => Boolean(text));
}

function toNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

// 세트 상품의 구성품은 products가 아니라 bundleproducts에만 있다.
// 구성품의 색상은 구성품 상품 자체의 COLOR 옵션에서 가져온다.
function buildComponents(
  source: DumpProduct,
  byProductNo: Map<number, DumpProduct>,
): CatalogComponent[] {
  return (source.bundleComponents ?? []).map((component) => {
    const target = byProductNo.get(component.product_no);
    const colors = (findColorGroup(target?.options)?.option_value ?? [])
      .map((value) => value.option_text)
      .filter((text): text is string => Boolean(text));

    const result: CatalogComponent = {
      productCode: component.product_code,
      name: component.product_name,
    };

    if ((component.purchase_quantity ?? 1) !== 1) {
      result.quantity = component.purchase_quantity;
    }
    if (colors.length > 0) {
      result.colors = colors;
    }

    return result;
  });
}

function main(): void {
  const root = process.cwd();
  const dumpPath = path.join(root, "cafe24-products.json");
  const jsonPath = path.join(root, "product.json");

  const dump = JSON.parse(readFileSync(dumpPath, "utf8")) as DumpProduct[];
  const catalog = JSON.parse(readFileSync(jsonPath, "utf8")) as CatalogProduct[];
  const byProductNo = new Map(dump.map((item) => [item.product_no, item]));

  let updated = 0;
  let missing = 0;
  const newColors: string[] = [];

  for (const product of catalog) {
    const source = byProductNo.get(product.productNo);

    if (!source) {
      missing += 1;
      console.error(`✗ 덤프에 없음: ${product.productName} (${product.productNo})`);
      continue;
    }

    const changes: string[] = [];

    if (source.product_name && source.product_name !== product.productName) {
      changes.push(`상품명 ${product.productName} → ${source.product_name}`);
      product.productName = source.product_name;
    }

    const prices: [keyof CatalogProduct, number | undefined, string][] = [
      ["consumerPrice", toNumber(source.retail_price), "소비자가"],
      ["salePrice", toNumber(source.price), "판매가"],
      ["productPrice", toNumber(source.price_excluding_tax), "공급가(부가세 별도)"],
      ["supplyPrice", toNumber(source.supply_price), "공급가"],
    ];

    for (const [key, value, label] of prices) {
      if (value === undefined || value === product[key]) continue;
      changes.push(`${label} ${product[key] ?? "-"} → ${value}`);
      (product[key] as number) = value;
    }

    // 옵션 그룹은 TYPE·COLOR·SIZE가 섞여 온다. COLOR 그룹만 colors에 대응한다.
    // 그룹이 하나뿐이면 이름이 달라도(예: '선택') 그게 색상 그룹이다.
    // 이미 colors가 비어 있는 상품은 수작업으로 비워둔 것이므로 새로 채우지 않는다.
    // 세트 상품은 옵션이 없고 구성품으로 갈린다. components가 비어 있으면 화면에 아무것도 뜨지 않는다.
    if ((source.bundleComponents?.length ?? 0) > 0) {
      if (!product.components?.length) {
        product.components = buildComponents(source, byProductNo);
        delete product.colors;
        changes.push(
          `구성품 ${product.components.map((component) => component.name).join(" + ")}`,
        );
      }

      if (changes.length > 0) {
        updated += 1;
        console.log(`- ${product.productName} (${product.productNo})`);
        for (const change of changes) console.log(`    ${change}`);
      }
      continue;
    }

    // sizes가 비어 있으면 화면에서 사이즈를 고를 수 없고 단가도 기본가로 굳는다.
    const sizeTexts = optionTextsOf(findSizeGroup(source.options));
    if (sizeTexts.length > 0 && !product.sizes?.length) {
      product.sizes = sizeTexts;
      changes.push(`사이즈 ${sizeTexts.join("/")}`);
    }

    const colorGroup = findColorGroup(source.options);
    // option_color는 카페24 관리자에서 색상칩을 지정한 옵션에만 값이 있다(없으면 빈 문자열).
    const optionColors = (colorGroup?.option_value ?? [])
      .filter((value): value is { option_text: string; option_color?: string } =>
        Boolean(value.option_text),
      )
      .map((value) => ({ text: value.option_text, hex: value.option_color ?? "" }));
    const optionTexts = optionColors.map((option) => option.text);
    const current = product.colors;

    if (optionTexts.length > 0 && current && Object.keys(current).length > 0) {
      const next: Record<string, string> = {};
      // 기존 키에 연속 공백이 섞인 경우가 있다("소프트블랙  패밀리").
      // 공백만 다른 키를 신규 색상으로 잘못 잡아 hex를 잃지 않도록 정규화해서 찾는다.
      const currentByNormalized = new Map(
        Object.entries(current).map(([key, hex]) => [normalizeSpace(key), hex]),
      );
      let added = 0;
      let filled = 0;

      for (const { text, hex } of optionColors) {
        // 카페24가 색상칩을 가진 옵션은 API 값이 정답이다. 없을 때만 기존 값을 유지한다.
        const existing = currentByNormalized.get(normalizeSpace(text));
        next[text] = hex || existing || "";

        if (existing === undefined) {
          added += 1;
        }
        if (hex && hex.toLowerCase() !== (existing ?? "").toLowerCase()) {
          filled += 1;
          changes.push(`색상코드 ${text} ${existing || "(없음)"} → ${hex}`);
        }
        if (!next[text]) {
          newColors.push(`${product.productName} (${product.productNo}): ${text}`);
        }
      }

      const nextKeys = new Set(Object.keys(next).map(normalizeSpace));
      const removed = Object.keys(current).filter(
        (key) => !nextKeys.has(normalizeSpace(key)),
      );
      if (removed.length > 0 || added > 0) {
        changes.push(`옵션 ${Object.keys(current).join("/")} → ${optionTexts.join("/")}`);
      }

      product.colors = next;
    }

    if (changes.length > 0) {
      updated += 1;
      console.log(`- ${product.productName} (${product.productNo})`);
      for (const change of changes) console.log(`    ${change}`);
    }
  }

  if (newColors.length > 0) {
    console.log(`\n[색상코드 미입력] ${newColors.length}건 — hex를 직접 채워야 한다.`);
    for (const line of newColors) console.log(`  ${line}`);
  }

  if (ADD_NEW) {
    const known = new Set(catalog.map((product) => product.productNo));
    const added: CatalogProduct[] = [];

    for (const source of dump) {
      if (known.has(source.product_no)) continue;
      if (source.display !== "T" || source.selling !== "T") continue;
      if (SKIP_NAME_PATTERN.test(source.product_name)) continue;

      const colors: Record<string, string> = {};

      for (const value of findColorGroup(source.options)?.option_value ?? []) {
        if (!value.option_text) continue;
        colors[value.option_text] = value.option_color ?? "";
      }

      const components =
        (source.bundleComponents?.length ?? 0) > 0
          ? buildComponents(source, byProductNo)
          : undefined;
      const sizes = optionTextsOf(findSizeGroup(source.options));

      // internalCode·category는 API에 대응 값이 없다. 사람이 채워야 하므로 빈 값으로 둔다.
      added.push({
        productCode: source.product_code,
        internalCode: "",
        category: "",
        productNo: source.product_no,
        productName: source.product_name,
        consumerPrice: toNumber(source.retail_price) ?? 0,
        supplyPrice: toNumber(source.supply_price) ?? 0,
        productPrice: toNumber(source.price_excluding_tax) ?? 0,
        salePrice: toNumber(source.price) ?? 0,
        ...(components
          ? { components }
          : sizes.length > 0
            ? { sizes }
            : { colors }),
      });
    }

    catalog.push(...added);
    console.log(`\n[신규 추가] ${added.length}건 — internalCode·category를 채워야 한다.`);
    for (const product of added) {
      console.log(`  ${product.productNo} ${product.productName}`);
    }
  }

  if (WRITE) {
    writeFileSync(jsonPath, `${JSON.stringify(catalog, null, 4)}\n`, "utf8");
    console.log(`\n✓ product.json 반영 완료 (변경 ${updated}건, 덤프 누락 ${missing}건)`);
  } else {
    console.log(`\n(dry-run) 변경 ${updated}건, 덤프 누락 ${missing}건 — 반영하려면 --write 옵션으로 실행`);
  }
}

main();
