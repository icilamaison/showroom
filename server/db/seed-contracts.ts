import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { CatalogProduct } from "../../lib/product-catalog";
import {
  createSetComponentSelections,
  formatSetOptionName,
} from "../../lib/set-product";
import {
  createEmptyProductRows,
  type ProductRow,
} from "../../lib/validation/contract";
import { parseContractInput } from "../schemas/contract.schema";
import { pool } from "./pool";

const COUNT = 10;
const SEED_PHONE_PREFIX = "010-9000";
const NAMES = [
  "김민지", "이수현", "박지훈", "최유진", "정하은",
  "한소율", "오지민", "강서준", "윤다연", "임태양",
  "송하늘", "배은우", "조아린", "홍성민", "신예린",
  "권도현", "문서연", "나윤호", "유채원", "장현우",
];
const STATUSES = ["SUBMITTED", "REVIEWING", "CONFIRMED"] as const;
const ADDRESSES = [
  { postal: "06234", address: "서울특별시 강남구 테헤란로 1", detail: "101호" },
  { postal: "04157", address: "서울특별시 마포구 월드컵북로 396", detail: "1203호" },
  { postal: "48058", address: "부산광역시 해운대구 센텀중앙로 35", detail: "5층" },
  { postal: "35229", address: "대전광역시 서구 둔산로 100", detail: "B동 202호" },
  { postal: "21984", address: "인천광역시 연수구 송도과학로 16", detail: "801호" },
];

function loadCatalog(): CatalogProduct[] {
  const filePath = path.join(process.cwd(), "product.json");
  return JSON.parse(readFileSync(filePath, "utf8")) as CatalogProduct[];
}

function pad(n: number, size = 2) {
  return String(n).padStart(size, "0");
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function pickDiverseProducts(catalog: CatalogProduct[]): CatalogProduct[] {
  return shuffle(catalog).slice(0, COUNT);
}

function buildProductRow(product: CatalogProduct, variant: number): ProductRow {
  if (product.components?.length) {
    const selections = createSetComponentSelections(product.components);
    for (const [index, component] of product.components.entries()) {
      if (component.colors?.length) {
        selections[index].color =
          component.colors[variant % component.colors.length];
      }
      if (component.sizes?.length) {
        selections[index].size =
          component.sizes[variant % component.sizes.length];
      }
    }

    return {
      name: product.productName,
      color: formatSetOptionName(product.components, selections),
      size: "",
      quantity: String((variant % 3) + 1),
      unitPrice: String(product.salePrice),
      remarks: "",
    };
  }

  const colorKeys = product.colors ? Object.keys(product.colors) : [];
  const sizes = product.sizes ?? [];

  return {
    name: product.productName,
    color: colorKeys[variant % colorKeys.length] ?? "",
    size: sizes[variant % sizes.length] ?? "",
    quantity: String((variant % 3) + 1),
    unitPrice: String(product.salePrice),
    remarks: "",
  };
}

function buildContractFormValues(
  catalog: CatalogProduct[],
  seedProducts: CatalogProduct[],
  index: number,
) {
  const no = index + 1;
  const primary = seedProducts[index];
  const secondary = catalog[(index * 17 + 11) % catalog.length];
  const day = pad(no);
  const writtenDate = `2026-07-${day}`;
  const address = ADDRESSES[index % ADDRESSES.length];
  const buyerName = NAMES[index];
  const useBankTransfer = index % 4 === 0;
  const status = STATUSES[index % STATUSES.length];

  const products = createEmptyProductRows();
  products[0] = buildProductRow(primary, index);

  if (index % 3 === 1 && secondary.productCode !== primary.productCode) {
    products[1] = buildProductRow(secondary, index + 1);
  }

  return {
    managerName: ["이서연", "박준호", "최다은"][index % 3],
    writtenDateYear: "2026",
    writtenDateMonth: "7",
    writtenDateDay: String(no),
    buyerName,
    buyerPhone: `${SEED_PHONE_PREFIX}-${pad(no, 4)}`,
    recipientSameAsBuyer: index % 5 !== 0,
    recipientName: index % 5 !== 0 ? "" : NAMES[(index + 7) % NAMES.length],
    recipientPhone: index % 5 !== 0 ? "" : `${SEED_PHONE_PREFIX}-${pad(no + 100, 4)}`,
    recipientPostalCode: address.postal,
    recipientAddress: address.address,
    recipientAddressDetail: `${address.detail.replace("호", "")}${no}호`,
    products,
    paymentMethod: useBankTransfer ? ("bank_transfer" as const) : ("card" as const),
    cashReceiptType: useBankTransfer ? ("income_deduction" as const) : ("" as const),
    cashReceiptPhone: useBankTransfer ? `${SEED_PHONE_PREFIX}-${pad(no, 4)}` : "",
    cashReceiptBusinessNumber: "",
    taxInvoiceRequested: false,
    taxInvoiceEmail: "",
    agreementDateYear: "2026",
    agreementDateMonth: "7",
    agreementDateDay: String(no),
    signatureName: buyerName,
    signatureDataUrl: "data:image/png;base64,seed-signature",
    termsAgreed: true as const,
    writtenDate,
    agreementDate: writtenDate,
    createdAt: `${writtenDate}T${pad(9 + (index % 8))}:30:00+09:00`,
    status,
  };
}

export async function clearAllContracts(): Promise<number> {
  const result = await pool.query("DELETE FROM contracts");
  return result.rowCount ?? 0;
}

export async function seedSampleContracts(options: { reset?: boolean } = {}) {
  if (options.reset) {
    const deleted = await clearAllContracts();
    console.log(`[seed] Deleted ${deleted} contracts`);
  }

  const catalog = loadCatalog();
  const seedProducts = pickDiverseProducts(catalog);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (let index = 0; index < COUNT; index += 1) {
      const row = buildContractFormValues(catalog, seedProducts, index);
      const parsed = parseContractInput(row);

      if (!parsed.success) {
        throw new Error(JSON.stringify(parsed.errors));
      }

      const mapped = parsed.data;
      const contractNumber = `CT-202607${pad(index + 1)}-${pad(index + 1, 4)}`;
      const payload = {
        ...row,
        writtenDate: mapped.writtenDate,
        agreementDate: mapped.agreementDate,
      };

      await client.query(
        `INSERT INTO contracts (
          contract_number, customer_name, customer_phone, customer_address,
          product_name, contract_amount, contract_start_date, contract_end_date,
          special_terms, terms_agreed, signature_name, status, payload,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $14
        )`,
        [
          contractNumber,
          mapped.customerName,
          mapped.customerPhone,
          mapped.customerAddress,
          mapped.productName,
          mapped.contractAmount,
          mapped.contractStartDate,
          mapped.contractEndDate,
          mapped.specialTerms || null,
          mapped.termsAgreed,
          mapped.signatureName,
          row.status,
          JSON.stringify(payload),
          row.createdAt,
        ],
      );
    }

    await client.query("COMMIT");
    console.log(`[seed] Inserted ${COUNT} diverse contracts from product.json`);
    console.log(
      "[seed] Sample products:",
      seedProducts.map((product) => product.productName).join(", "),
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await seedSampleContracts({ reset: process.argv.includes("--reset") });
  } catch (error) {
    console.error("[seed] Failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  void main();
}
