import { z } from "zod";
import { formatFullAddress } from "../../lib/address";
import { applyTotalDiscount, contractTotal } from "../../lib/contract-amount";
import {
  contractFormSchema,
  formatValidationErrors,
  type ContractFormValues,
} from "../../lib/validation/contract";

export const contractInputSchema = contractFormSchema;

export type ContractInput = z.infer<typeof contractInputSchema> & {
  writtenDate: string;
  agreementDate: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  productName: string;
  contractAmount: number;
  contractStartDate: string;
  contractEndDate: string;
  specialTerms: string;
};

function buildDateString(year: string, month: string, day: string): string {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function mapContractInput(
  data: z.infer<typeof contractInputSchema>,
): ContractInput {
  const writtenDate = buildDateString(
    data.writtenDateYear,
    data.writtenDateMonth,
    data.writtenDateDay,
  );
  const agreementDate = buildDateString(
    data.agreementDateYear,
    data.agreementDateMonth,
    data.agreementDateDay,
  );

  const filledProducts = data.products.filter((product) => product.name.trim());
  const contractAmount = applyTotalDiscount(
    contractTotal(data.products),
    data.totalDiscountRate,
  );

  return {
    ...data,
    products: data.products.map((product) => ({
      ...product,
      remarks: "",
    })),
    writtenDate,
    agreementDate,
    customerName: data.buyerName,
    customerPhone: data.buyerPhone,
    customerAddress: formatFullAddress(
      data.recipientAddress,
      data.recipientAddressDetail,
    ),
    productName:
      filledProducts.map((product) => product.name.trim()).join(", ") || "-",
    contractAmount,
    contractStartDate: writtenDate,
    contractEndDate: agreementDate,
    specialTerms: buildSpecialTerms(data),
  };
}

function buildSpecialTerms(data: z.infer<typeof contractInputSchema>): string {
  const parts: string[] = [];

  if (data.managerName.trim()) {
    parts.push(`담당자: ${data.managerName.trim()}`);
  }

  parts.push(
    `결제수단: ${data.paymentMethod === "card" ? "카드" : "계좌이체"}`,
  );

  if (data.paymentMethod === "bank_transfer" && data.cashReceiptType) {
    const receiptLabel =
      data.cashReceiptType === "income_deduction"
        ? `소득공제용(${data.cashReceiptPhone})`
        : `지출증빙용(${data.cashReceiptBusinessNumber})`;
    parts.push(`현금영수증: ${receiptLabel}`);
  }

  if (data.taxInvoiceRequested) {
    parts.push(`세금계산서: ${data.taxInvoiceEmail}`);
  }

  return parts.join(" | ");
}

export const formatContractSchemaErrors = formatValidationErrors;

export function parseContractInput(body: unknown):
  | { success: true; data: ContractInput }
  | { success: false; errors: Record<string, string> } {
  const result = contractInputSchema.safeParse(body);

  if (result.success) {
    return { success: true, data: mapContractInput(result.data) };
  }

  return {
    success: false,
    errors: formatValidationErrors(result.error),
  };
}

export type { ContractFormValues };
