import "dotenv/config";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { URL } from "node:url";
import {
  getSizeOptionName,
  getSizeSalePrice,
  type CatalogProduct,
} from "../../lib/product-catalog";
import { syncGiftRows } from "../../lib/contract-gift";
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

const DEFAULT_COUNT = 30;
const SEED_PHONE_PREFIX = "010-9000";
// 보이는 가짜 서명. 유효한 data URL이라 엑박이 나지 않는다
const SEED_SIGNATURE_DATA_URL =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="80" viewBox="0 0 220 80">
      <path d="M10 50 C40 10, 70 70, 100 40 S160 20, 210 45" fill="none" stroke="#222" stroke-width="3" stroke-linecap="round"/>
      <path d="M30 55 C60 35, 90 75, 130 50" fill="none" stroke="#222" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
  );
const NAMES = [
  "김민지", "이수현", "박지훈", "최유진", "정하은",
  "한소율", "오지민", "강서준", "윤다연", "임태양",
  "송하늘", "배은우", "조아린", "홍성민", "신예린",
  "권도현", "문서연", "나윤호", "유채원", "장현우",
  "서형이", "김수지", "오세린", "배수아", "문지호",
  "한가은", "노윤서", "진예원", "류도윤", "안서준",
];
const STATUSES = [
  "DRAFTING",
  "SUBMITTED",
  "ON_HOLD",
  "CONFIRMED",
  "CANCEL_PENDING",
  "CANCELED",
  "SUBMITTED",
  "CONFIRMED",
  "ON_HOLD",
  "DRAFTING",
] as const;
const ADDRESSES = [
  { postal: "06234", address: "서울특별시 강남구 테헤란로 1", detail: "101호" },
  { postal: "04157", address: "서울특별시 마포구 월드컵북로 396", detail: "1203호" },
  { postal: "48058", address: "부산광역시 해운대구 센텀중앙로 35", detail: "5층" },
  { postal: "35229", address: "대전광역시 서구 둔산로 100", detail: "B동 202호" },
  { postal: "21984", address: "인천광역시 연수구 송도과학로 16", detail: "801호" },
];
const GIFT_COLORS = ["아이보리", "블루", "베이지", "그레이"];

function parseCount(argv: string[]): number {
  const flag = argv.find((arg) => arg.startsWith("--count="));
  if (!flag) return DEFAULT_COUNT;
  const value = Number(flag.slice("--count=".length));
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_COUNT;
}

function assertLocalDatabase(): void {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is not set");
  const host = new URL(dbUrl).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(`REFUSING non-local DB host: ${host}`);
  }
  console.log(`[seed] local DB host=${host} db=${new URL(dbUrl).pathname}`);
}

function loadCatalog(): CatalogProduct[] {
  const cafe24 = JSON.parse(
    readFileSync(path.join(process.cwd(), "product.json"), "utf8"),
  ) as CatalogProduct[];
  const showroom = JSON.parse(
    readFileSync(path.join(process.cwd(), "showroom-product.json"), "utf8"),
  ) as CatalogProduct[];
  return [...cafe24, ...showroom];
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

function isShowroomProduct(product: CatalogProduct): boolean {
  return String(product.productCode ?? "").startsWith("SHOWROOM-");
}

function buildProductRow(
  product: CatalogProduct,
  variant: number,
  options: { sizeIndex?: number; quantity?: string; forceShowroomDiscount?: boolean } = {},
): ProductRow {
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
      type: "",
      color: formatSetOptionName(product.components, selections),
      size: "",
      quantity: options.quantity ?? "1",
      unitPrice: String(product.salePrice),
      // 세트 상품 자체 할인(카페24 setDiscountRate)은 이미 세트가에 녹아 있을 수 있음
      discountRate:
        options.forceShowroomDiscount || isShowroomProduct(product)
          ? "5"
          : product.setDiscountRate
            ? String(product.setDiscountRate)
            : "",
      remarks: "",
    };
  }

  const colorKeys = product.colors ? Object.keys(product.colors) : [];
  const types = product.types ?? [];
  const sizes = product.sizes ?? [];
  const sizeOption = sizes[options.sizeIndex ?? variant % Math.max(sizes.length, 1)];
  const sizeName = sizeOption ? getSizeOptionName(sizeOption) : "";
  const salePrice = getSizeSalePrice(product, sizeName) ?? product.salePrice;

  return {
    name: product.productName,
    type: types[variant % Math.max(types.length, 1)] ?? "",
    color: colorKeys[variant % Math.max(colorKeys.length, 1)] ?? "",
    size: sizeName,
    quantity: options.quantity ?? "1",
    unitPrice: String(salePrice),
    // 쇼룸 단독 상품 구매 시 추가 5% 할인
    discountRate:
      options.forceShowroomDiscount || isShowroomProduct(product) ? "5" : "",
    remarks: "",
  };
}

function applyRandomGiftColors(products: ProductRow[]): ProductRow[] {
  return products.map((product) => {
    if (!product.name.includes("브릭 쿠션커버")) return product;
    return {
      ...product,
      color: GIFT_COLORS[Math.floor(Math.random() * GIFT_COLORS.length)],
    };
  });
}

function pickShowroom(
  catalog: CatalogProduct[],
  code: string,
): CatalogProduct {
  const found = catalog.find((product) => product.productCode === code);
  if (!found) throw new Error(`showroom product missing: ${code}`);
  return found;
}

function buildContractFormValues(
  catalog: CatalogProduct[],
  index: number,
) {
  const no = index + 1;
  const day = pad(((no - 1) % 28) + 1);
  const month = "11";
  const writtenDate = `2026-${month}-${day}`;
  const address = ADDRESSES[index % ADDRESSES.length];
  const buyerName = NAMES[index % NAMES.length];
  const useBankTransfer = index % 4 === 0;
  const status = STATUSES[index % STATUSES.length];

  // 시나리오: 예약 5% / 쇼룸 단독 5% / 금액대별 사은품이 보이게 가격대를 나눈다
  const scenario = index % 10;
  const reservation = scenario !== 0 && scenario !== 4; // 네이버 예약 → 전체 5%
  const products = createEmptyProductRows();

  if (scenario === 0) {
    // 워크인·소액·사은품 없음
    const cheap =
      catalog.find((product) => !isShowroomProduct(product) && product.salePrice < 200000) ??
      catalog[0];
    products[0] = buildProductRow(cheap, index, { quantity: "1" });
    products[0].discountRate = "";
  } else if (scenario === 1 || scenario === 5) {
    // 예약 + 쇼룸 반호(~66만) → 할인 후 50만 구간
    products[0] = buildProductRow(pickShowroom(catalog, "SHOWROOM-01"), index, {
      sizeIndex: 0,
      quantity: "1",
    });
  } else if (scenario === 2 || scenario === 6) {
    // 예약 + 쇼룸 2호(~132만) → 100만 구간(쿠션 세트)
    products[0] = buildProductRow(pickShowroom(catalog, "SHOWROOM-02"), index, {
      sizeIndex: 1,
      quantity: "1",
    });
  } else if (scenario === 3 || scenario === 7) {
    // 예약 + 쇼룸 4호(~266만) → 150만 구간(+블랭킷)
    products[0] = buildProductRow(pickShowroom(catalog, "SHOWROOM-03"), index, {
      sizeIndex: 2,
      quantity: "1",
    });
  } else if (scenario === 4) {
    // 워크인 + 쇼룸 단독만 5% (예약 할인 없음)
    products[0] = buildProductRow(pickShowroom(catalog, "SHOWROOM-01"), index, {
      sizeIndex: 0,
      quantity: "1",
    });
  } else {
    // 예약 + 쇼룸/일반 혼합
    products[0] = buildProductRow(pickShowroom(catalog, "SHOWROOM-04"), index, {
      sizeIndex: 1,
      quantity: "1",
    });
    const extra = shuffle(catalog.filter((product) => !isShowroomProduct(product)))[0];
    if (extra) {
      products[1] = buildProductRow(extra, index + 1, { quantity: "1" });
      products[1].discountRate = "";
    }
  }

  const totalDiscountRate = reservation ? "5" : "";
  const withGifts = applyRandomGiftColors(
    syncGiftRows(products, totalDiscountRate, true, false),
  );

  return {
    managerName: ["이서연", "박준호", "최다은", "showroom"][index % 4],
    visitType: reservation ? ("reservation" as const) : ("walk_in" as const),
    writtenDateYear: "2026",
    writtenDateMonth: String(Number(month)),
    writtenDateDay: String(Number(day)),
    buyerName,
    buyerPhone: `${SEED_PHONE_PREFIX}-${pad(no, 4)}`,
    recipientSameAsBuyer: index % 5 !== 0,
    recipientName: index % 5 !== 0 ? "" : NAMES[(index + 7) % NAMES.length],
    recipientPhone: index % 5 !== 0 ? "" : `${SEED_PHONE_PREFIX}-${pad(no + 100, 4)}`,
    recipientPostalCode: address.postal,
    recipientAddress: address.address,
    recipientAddressDetail: `${address.detail.replace("호", "")}${no}호`,
    products: withGifts,
    paymentMethod: useBankTransfer ? ("bank_transfer" as const) : ("card" as const),
    cashReceiptType: useBankTransfer ? ("income_deduction" as const) : ("" as const),
    cashReceiptPhone: useBankTransfer ? `${SEED_PHONE_PREFIX}-${pad(no, 4)}` : "",
    cashReceiptBusinessNumber: "",
    taxInvoiceRequested: false,
    taxInvoiceEmail: "",
    agreementDateYear: "2026",
    agreementDateMonth: String(Number(month)),
    agreementDateDay: String(Number(day)),
    signatureName: buyerName,
    signatureDataUrl: SEED_SIGNATURE_DATA_URL,
    termsAgreed: true as const,
    marketingConsentAgreed: index % 3 !== 0,
    largeRugNoticeAgreed: true,
    size4DeliveryAgreed: true,
    totalDiscountRate,
    giftProvided: true,
    gooseGiftProvided: false,
    padPurchased: null,
    padQuantity: "",
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

export async function seedSampleContracts(
  options: { reset?: boolean; count?: number } = {},
) {
  const count = options.count ?? DEFAULT_COUNT;

  if (options.reset) {
    const deletedAudits = await pool.query("DELETE FROM audit_logs");
    const deleted = await clearAllContracts();
    console.log(
      `[seed] Deleted contracts=${deleted} audit_logs=${deletedAudits.rowCount ?? 0}`,
    );
  }

  const catalog = loadCatalog();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (let index = 0; index < count; index += 1) {
      const row = buildContractFormValues(catalog, index);
      const parsed = parseContractInput(row);

      if (!parsed.success) {
        throw new Error(JSON.stringify(parsed.errors));
      }

      const mapped = parsed.data;
      const contractNumber = `CT-2026${pad(Number(row.writtenDateMonth))}${pad(Number(row.writtenDateDay))}-${pad(index + 1, 4)}`;
      const payload = {
        ...row,
        writtenDate: mapped.writtenDate,
        agreementDate: mapped.agreementDate,
      };

      const approvalNumber = String(
        30000000 + Math.floor(Math.random() * 69999999),
      );

      await client.query(
        `INSERT INTO contracts (
          contract_number, customer_name, customer_phone, customer_address,
          product_name, contract_amount, contract_start_date, contract_end_date,
          special_terms, terms_agreed, signature_name, status, approval_number,
          view_token, view_token_issued_at, payload, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $15, $15
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
          approvalNumber,
          randomBytes(24).toString("hex"),
          row.createdAt,
          JSON.stringify(payload),
        ],
      );
    }

    await client.query("COMMIT");
    console.log(`[seed] Inserted ${count} showroom-benefit contracts`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    assertLocalDatabase();
    await seedSampleContracts({
      reset: process.argv.includes("--reset"),
      count: parseCount(process.argv),
    });
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
