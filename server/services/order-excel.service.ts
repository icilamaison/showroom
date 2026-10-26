import ExcelJS from "exceljs";
import path from "node:path";
import {
  buildOrderExcelRows,
  findMissingOrderExcelRequiredFields,
  formatShoppingMallOrderNumber,
  isPurchaseContractPayload,
  ORDER_EXCEL_HEADERS,
  type OrderExcelRow,
} from "../../lib/order-excel";
import type { ContractDetail } from "./admin-contract.service";

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "server",
  "assets",
  "manual-order-template.xlsx",
);

const MAX_COLUMN_WIDTH = 255; // 엑셀 열 너비 상한

// 엑셀 열 너비 단위는 영문 한 글자 기준이라 한글 등 전각 문자는 2칸으로 센다
function getTextWidth(value: string): number {
  let width = 0;
  for (const char of value) {
    width += /[ᄀ-ᇿ　-鿿가-힯＀-￯]/.test(char) ? 2 : 1;
  }
  return width;
}

// 열마다 가장 긴 값(머리글 포함)에 맞춰 너비를 넓힌다
function fitColumnWidths(sheet: ExcelJS.Worksheet): void {
  sheet.columns.forEach((column) => {
    let maxWidth = 0;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      maxWidth = Math.max(maxWidth, getTextWidth(String(cell.value ?? "")));
    });
    column.width = Math.min(maxWidth + 2, MAX_COLUMN_WIDTH);
  });
}

export class OrderExcelGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderExcelGenerationError";
  }
}

async function createOrderExcelWorkbook(
  rows: OrderExcelRow[],
): Promise<ExcelJS.Workbook> {
  const templateWorkbook = new ExcelJS.Workbook();
  await templateWorkbook.xlsx.readFile(TEMPLATE_PATH);

  const uploadSheet = templateWorkbook.getWorksheet("업로드 양식");
  const countrySheet = templateWorkbook.getWorksheet("국가코드표");

  if (!uploadSheet) {
    throw new OrderExcelGenerationError("엑셀 템플릿 시트를 찾을 수 없습니다.");
  }

  const workbook = new ExcelJS.Workbook();
  const outputUploadSheet = workbook.addWorksheet("업로드 양식");
  outputUploadSheet.addRow([...ORDER_EXCEL_HEADERS]);

  for (const row of rows) {
    outputUploadSheet.addRow(
      ORDER_EXCEL_HEADERS.map((header) => row[header] ?? ""),
    );
  }

  fitColumnWidths(outputUploadSheet);

  if (countrySheet) {
    const outputCountrySheet = workbook.addWorksheet("국가코드표");
    countrySheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      outputCountrySheet.getRow(rowNumber).values = row.values;
    });
  }

  return workbook;
}

async function workbookToBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function collectOrderExcelRows(
  contracts: ContractDetail[],
  resolveShoppingMallOrderNumber: (
    contract: ContractDetail,
  ) => string = () => "",
): OrderExcelRow[] {
  const rows: OrderExcelRow[] = [];
  const skippedContracts: string[] = [];

  for (const contract of contracts) {
    try {
      if (!isPurchaseContractPayload(contract.payload)) {
        skippedContracts.push(contract.contractNumber);
        continue;
      }

      const contractRows = buildOrderExcelRows(
        contract.payload,
        resolveShoppingMallOrderNumber(contract),
      );

      if (contractRows.length === 0) {
        skippedContracts.push(contract.contractNumber);
        continue;
      }

      const missingFields = findMissingOrderExcelRequiredFields(contractRows);

      if (missingFields.length > 0) {
        skippedContracts.push(contract.contractNumber);
        continue;
      }

      rows.push(...contractRows);
    } catch {
      skippedContracts.push(contract.contractNumber);
    }
  }

  if (rows.length === 0) {
    const suffix =
      skippedContracts.length > 0
        ? ` (건너뜀: ${skippedContracts.join(", ")})`
        : "";

    throw new OrderExcelGenerationError(
      `엑셀로 변환할 주문이 없습니다.${suffix}`,
    );
  }

  return rows;
}

export async function generateOrderExcelBuffer(
  contract: ContractDetail,
  shoppingMallOrderNumber: string,
): Promise<Buffer> {
  const rows = collectOrderExcelRows([contract], () => shoppingMallOrderNumber);
  const workbook = await createOrderExcelWorkbook(rows);
  return workbookToBuffer(workbook);
}

export async function generateBulkOrderExcelBuffer(
  contracts: ContractDetail[],
): Promise<Buffer> {
  if (contracts.length === 0) {
    throw new OrderExcelGenerationError("다운로드할 계약서가 없습니다.");
  }

  const missingApprovalNumbers = contracts.filter(
    (contract) => !formatShoppingMallOrderNumber(contract.approvalNumber),
  );

  if (missingApprovalNumbers.length > 0) {
    const contractNumbers = missingApprovalNumbers
      .map((contract) => contract.contractNumber)
      .join(", ");

    throw new OrderExcelGenerationError(
      `계약번호 ${contractNumbers}는 SR 주문번호를 입력하지 않았습니다. 입력해주세요.`,
    );
  }

  const rows = collectOrderExcelRows(contracts, (contract) =>
    formatShoppingMallOrderNumber(contract.approvalNumber),
  );
  const workbook = await createOrderExcelWorkbook(rows);
  return workbookToBuffer(workbook);
}

export function buildOrderExcelFilename(contractNumber: string): string {
  const safeContractNumber = contractNumber.replace(/[^\w-]+/g, "_");
  return `playauto_order_${safeContractNumber}.xlsx`;
}

export function buildBulkOrderExcelFilename(
  dateFrom?: string,
  dateTo?: string,
): string {
  const from = dateFrom?.trim() || "all";
  const to = dateTo?.trim() || "all";
  return `playauto_orders_${from}_${to}.xlsx`;
}
