import ExcelJS from "exceljs";
import path from "node:path";
import {
  buildOrderExcelRows,
  findMissingOrderExcelRequiredFields,
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

function collectOrderExcelRows(contracts: ContractDetail[]): OrderExcelRow[] {
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
        contract.contractNumber,
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
): Promise<Buffer> {
  const rows = collectOrderExcelRows([contract]);
  const workbook = await createOrderExcelWorkbook(rows);
  return workbookToBuffer(workbook);
}

export async function generateBulkOrderExcelBuffer(
  contracts: ContractDetail[],
): Promise<Buffer> {
  if (contracts.length === 0) {
    throw new OrderExcelGenerationError("다운로드할 계약서가 없습니다.");
  }

  const rows = collectOrderExcelRows(contracts);
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
