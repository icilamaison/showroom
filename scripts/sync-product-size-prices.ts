import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type CatalogSizeOption =
  | string
  | {
      name: string;
      consumerPrice?: number;
      salePrice?: number;
      components?: unknown[];
    };

type CatalogProduct = {
  productCode: string;
  productName: string;
  salePrice: number;
  sizes?: CatalogSizeOption[];
};

type VariantRow = {
  productName: string;
  variantName: string;
  salePrice: number;
  addPrice: number;
};

function getSizeOptionName(option: CatalogSizeOption): string {
  return typeof option === "string" ? option : option.name;
}

function loadVariantsFromXlsx(filePath: string): Map<string, VariantRow[]> {
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
  const map = new Map<string, VariantRow[]>();

  for (const line of lines.slice(1)) {
    const columns = line.split("\t");
    const productName = columns[0]?.trim();
    const variantName = columns[1]?.trim();
    const salePrice = Number(columns[3] ?? 0);
    const addPrice = Number(columns[4] ?? 0);

    if (!productName || !variantName) {
      continue;
    }

    const rows = map.get(productName) ?? [];
    rows.push({ productName, variantName, salePrice, addPrice });
    map.set(productName, rows);
  }

  return map;
}

function extractSizeName(
  variantName: string,
  sizeNames: string[],
): string | null {
  if (sizeNames.includes(variantName)) {
    return variantName;
  }

  const slashParts = variantName.split("/");
  if (slashParts.length >= 2) {
    const sizePart = slashParts[slashParts.length - 1]?.trim() ?? "";
    if (sizeNames.includes(sizePart)) {
      return sizePart;
    }
  }

  for (const sizeName of sizeNames) {
    if (variantName.includes(sizeName)) {
      return sizeName;
    }
  }

  return null;
}

function buildSizePriceMap(
  product: CatalogProduct,
  variants: VariantRow[],
): Map<string, number> {
  const sizeNames = (product.sizes ?? []).map(getSizeOptionName);
  const priceBySize = new Map<string, number>();

  for (const variant of variants) {
    const sizeName = extractSizeName(variant.variantName, sizeNames);
    if (!sizeName) {
      continue;
    }

    priceBySize.set(sizeName, variant.salePrice + variant.addPrice);
  }

  return priceBySize;
}

function applySizePrices(
  product: CatalogProduct,
  priceBySize: Map<string, number>,
): CatalogProduct {
  if (!product.sizes?.length) {
    return product;
  }

  const nextSizes = product.sizes.map((option) => {
    const name = getSizeOptionName(option);
    const variantSalePrice = priceBySize.get(name);

    if (variantSalePrice == null || variantSalePrice === product.salePrice) {
      return option;
    }

    if (typeof option === "string") {
      return { name, salePrice: variantSalePrice };
    }

    return { ...option, salePrice: variantSalePrice };
  });

  return { ...product, sizes: nextSizes };
}

function main() {
  const root = process.cwd();
  const jsonPath = path.join(root, "product.json");
  const xlsxPath = path.join(root, "product3.xlsx");
  const catalog = JSON.parse(readFileSync(jsonPath, "utf8")) as CatalogProduct[];
  const variantsByName = loadVariantsFromXlsx(xlsxPath);

  let updated = 0;
  let unmatched = 0;

  const nextCatalog = catalog.map((product) => {
    if (!product.sizes?.length) {
      return product;
    }

    const variants = variantsByName.get(product.productName);
    if (!variants?.length) {
      unmatched += 1;
      return product;
    }

    const priceBySize = buildSizePriceMap(product, variants);
    const nextProduct = applySizePrices(product, priceBySize);

    if (JSON.stringify(nextProduct.sizes) !== JSON.stringify(product.sizes)) {
      updated += 1;
    }

    return nextProduct;
  });

  writeFileSync(jsonPath, `${JSON.stringify(nextCatalog, null, 4)}\n`, "utf8");

  console.log(`[sync-prices] Updated ${updated} products with size prices`);
  if (unmatched > 0) {
    console.log(`[sync-prices] ${unmatched} sized products had no product3 match`);
  }
}

main();
