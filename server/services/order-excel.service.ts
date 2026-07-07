import ExcelJS from "exceljs";
import path from "node:path";
import {
  buildOrderExcelRows,
  findMissingOrderExcelRequiredFields,
  isPurchaseContractPayload,
  ORDER_EXCEL_HEADERS,
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

export async function generateOrderExcelBuffer(
  contract: ContractDetail,
): Promise<Buffer> {
  if (!isPurchaseContractPayload(contract.payload)) {
    throw new OrderExcelGenerationError(
      "구매 계약서 형식의 데이터만 엑셀로 변환할 수 있습니다.",
    );
  }

  const rows = buildOrderExcelRows(contract.payload, contract.contractNumber);

  if (rows.length === 0) {
    throw new OrderExcelGenerationError(
      "엑셀로 변환할 상품 정보가 없습니다.",
    );
  }

  const missingFields = findMissingOrderExcelRequiredFields(rows);

  if (missingFields.length > 0) {
    throw new OrderExcelGenerationError(
      `PlayAuto 필수 항목이 비어 있습니다: ${missingFields.join(", ")}`,
    );
  }

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

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function buildOrderExcelFilename(contractNumber: string): string {
  const safeContractNumber = contractNumber.replace(/[^\w-]+/g, "_");
  return `playauto_order_${safeContractNumber}.xlsx`;
}
