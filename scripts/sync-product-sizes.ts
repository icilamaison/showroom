import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type CatalogProduct = {
  productCode: string;
  internalCode: string;
  category: string;
  productNo: number;
  productName: string;
  consumerPrice: number;
  supplyPrice: number;
  productPrice: number;
  salePrice: number;
  colors?: Record<string, string>;
  sizes?: string[];
};

function parseSizes(optionInput: string): string[] {
  const sizes = new Set<string>();

  for (const match of optionInput.matchAll(/SIZE\{([^}]*)\}/g)) {
    for (const part of match[1].split("|")) {
      const value = part.trim();
      if (value) {
        sizes.add(value);
      }
    }
  }

  return [...sizes];
}

function loadSizeMapFromXlsx(filePath: string): Map<string, string[]> {
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
  const map = new Map<string, string[]>();

  for (const line of lines.slice(1)) {
    const columns = line.split("\t");
    const productCode = columns[0]?.trim();
    const optionInput = columns[4]?.trim() ?? "";

    if (!productCode || !optionInput) {
      continue;
    }

    const sizes = parseSizes(optionInput);
    if (sizes.length > 0) {
      map.set(productCode, sizes);
    }
  }

  return map;
}

function main() {
  const root = process.cwd();
  const jsonPath = path.join(root, "product.json");
  const xlsxPath = path.join(root, "product.xlsx");
  const catalog = JSON.parse(readFileSync(jsonPath, "utf8")) as CatalogProduct[];
  const sizeMap = loadSizeMapFromXlsx(xlsxPath);

  let updated = 0;
  let missingInJson = 0;

  const nextCatalog = catalog.map((product) => {
    const sizes = sizeMap.get(product.productCode);

    if (!sizes) {
      const { sizes: _removed, ...rest } = product;
      return rest;
    }

    updated += 1;
    sizeMap.delete(product.productCode);

    return {
      ...product,
      sizes,
    };
  });

  missingInJson = sizeMap.size;

  writeFileSync(jsonPath, `${JSON.stringify(nextCatalog, null, 4)}\n`, "utf8");

  console.log(`[sync] Updated ${updated} products with sizes`);
  if (missingInJson > 0) {
    console.log(`[sync] ${missingInJson} product codes in xlsx were not found in json`);
  }
}

main();
