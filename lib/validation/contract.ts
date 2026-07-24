import { z } from "zod";

const phoneRegex = /^010-\d{4}-\d{4}$/;
const businessNumberRegex = /^\d{3}-\d{2}-\d{5}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const postalCodeRegex = /^\d{5}$/;
const amountRegex = /^\d+$/;

export const PRODUCT_ROW_COUNT = 10;

export type ProductRow = {
  name: string;
  color: string;
  size: string;
  quantity: string;
  unitPrice: string;
  remarks: string;
};

export function createEmptyProductRow(): ProductRow {
  return {
    name: "",
    color: "",
    size: "",
    quantity: "",
    unitPrice: "",
    remarks: "",
  };
}

export function createEmptyProductRows(): ProductRow[] {
  return Array.from({ length: PRODUCT_ROW_COUNT }, () => createEmptyProductRow());
}

export type ContractFormValues = {
  managerName: string;
  writtenDateYear: string;
  writtenDateMonth: string;
  writtenDateDay: string;
  buyerName: string;
  buyerPhone: string;
  recipientSameAsBuyer: boolean | null;
  recipientName: string;
  recipientPhone: string;
  recipientPostalCode: string;
  recipientAddress: string;
  recipientAddressDetail: string;
  products: ProductRow[];
  totalDiscountRate: string;
  paymentMethod: "card" | "bank_transfer" | "";
  cashReceiptType: "income_deduction" | "expense_proof" | "";
  cashReceiptPhone: string;
  cashReceiptBusinessNumber: string;
  taxInvoiceRequested: boolean;
  taxInvoiceEmail: string;
  agreementDateYear: string;
  agreementDateMonth: string;
  agreementDateDay: string;
  signatureName: string;
  signatureDataUrl?: string;
  termsAgreed: boolean;
  marketingConsentAgreed: boolean;
};

const yearSchema = z
  .string({ required_error: "연도를 입력해주세요." })
  .trim()
  .regex(/^\d{4}$/, "연도를 4자리로 입력해주세요.");
const monthSchema = z
  .string({ required_error: "월을 입력해주세요." })
  .trim()
  .regex(/^(0?[1-9]|1[0-2])$/, "월을 1~12 사이로 입력해주세요.");
const daySchema = z
  .string({ required_error: "일을 입력해주세요." })
  .trim()
  .regex(/^(0?[1-9]|[12]\d|3[01])$/, "일을 1~31 사이로 입력해주세요.");

const productRowSchema = z.object({
  name: z.string().trim(),
  color: z.string().trim(),
  size: z.string().trim(),
  quantity: z.string().trim(),
  unitPrice: z.string().trim(),
  remarks: z.string().trim(),
});

function buildDateString(year: string, month: string, day: string): string {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function isValidDateParts(year: string, month: string, day: string): boolean {
  const date = new Date(
    `${buildDateString(year, month, day)}T00:00:00+09:00`,
  );
  return !Number.isNaN(date.getTime());
}

const contractFormSchema = z
  .object({
    managerName: z.string().trim().max(50, "담당자명은 50자 이하로 입력해주세요."),
    writtenDateYear: yearSchema,
    writtenDateMonth: monthSchema,
    writtenDateDay: daySchema,
    buyerName: z
      .string({ required_error: "구매자 성명을 입력해주세요." })
      .trim()
      .min(2, "구매자 성명은 2자 이상 50자 이하로 입력해주세요.")
      .max(50, "구매자 성명은 2자 이상 50자 이하로 입력해주세요."),
    buyerPhone: z
      .string({ required_error: "구매자 연락처를 입력해주세요." })
      .trim()
      .regex(phoneRegex, "연락처는 010-0000-0000 형식으로 입력해주세요."),
    recipientSameAsBuyer: z.boolean({
      required_error: "수령자 정보를 선택해주세요.",
      invalid_type_error: "수령자 정보를 선택해주세요.",
    }),
    recipientName: z.string().trim().max(50, "수령자 성명은 50자 이하로 입력해주세요."),
    recipientPhone: z.string().trim(),
    recipientPostalCode: z.string().trim(),
    recipientAddress: z.string().trim(),
    recipientAddressDetail: z.string().trim(),
    products: z.array(productRowSchema).min(PRODUCT_ROW_COUNT),
    totalDiscountRate: z.string().trim().default(""),
    paymentMethod: z.enum(["card", "bank_transfer"], {
      errorMap: () => ({ message: "결제수단을 선택해주세요." }),
    }),
    cashReceiptType: z.enum(["income_deduction", "expense_proof", ""]).optional(),
    cashReceiptPhone: z.string().trim().default(""),
    cashReceiptBusinessNumber: z.string().trim().default(""),
    taxInvoiceRequested: z.boolean().default(false),
    taxInvoiceEmail: z.string().trim().default(""),
    agreementDateYear: yearSchema,
    agreementDateMonth: monthSchema,
    agreementDateDay: daySchema,
    signatureName: z
      .string({ required_error: "서명명을 입력해주세요." })
      .trim()
      .min(2, "서명명은 2자 이상 50자 이하로 입력해주세요.")
      .max(50, "서명명은 2자 이상 50자 이하로 입력해주세요."),
    signatureDataUrl: z.string().trim().min(1, "서명을 입력해주세요."),
    termsAgreed: z.literal(true, {
      errorMap: () => ({
        message: "개인정보 수집·이용에 동의해야 합니다.",
      }),
    }),
    marketingConsentAgreed: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (
      !isValidDateParts(
        data.writtenDateYear,
        data.writtenDateMonth,
        data.writtenDateDay,
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["writtenDateDay"],
        message: "유효한 작성일자를 입력해주세요.",
      });
    }

    if (
      !isValidDateParts(
        data.agreementDateYear,
        data.agreementDateMonth,
        data.agreementDateDay,
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["agreementDateDay"],
        message: "유효한 동의 일자를 입력해주세요.",
      });
    }

    if (!data.recipientSameAsBuyer) {
      if (!data.recipientName || data.recipientName.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recipientName"],
          message: "수령자 성명을 입력해주세요.",
        });
      }

      if (!phoneRegex.test(data.recipientPhone)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recipientPhone"],
          message: "수령자 연락처는 010-0000-0000 형식으로 입력해주세요.",
        });
      }

    }

    if (!postalCodeRegex.test(data.recipientPostalCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recipientPostalCode"],
        message: "우편번호는 주소 검색으로 입력해주세요.",
      });
    }

    if (!data.recipientAddress.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recipientAddress"],
        message: "주소 검색을 이용해주세요.",
      });
    }

    const filledProducts = data.products.filter((product) => product.name.trim());

    if (filledProducts.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["products"],
        message: "상품 정보를 1개 이상 입력해주세요.",
      });
    }

    for (const [index, product] of data.products.entries()) {
      if (!product.name.trim()) {
        continue;
      }

      if (!product.quantity.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["products", index, "quantity"],
          message: "수량을 입력해주세요.",
        });
      } else if (!/^\d+$/.test(product.quantity) || Number(product.quantity) < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["products", index, "quantity"],
          message: "수량은 1 이상의 숫자로 입력해주세요.",
        });
      }

      if (!product.unitPrice.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["products", index, "unitPrice"],
          message: "금액을 입력해주세요.",
        });
      } else if (!amountRegex.test(product.unitPrice) || Number(product.unitPrice) < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["products", index, "unitPrice"],
          message: "금액은 1 이상의 숫자로 입력해주세요.",
        });
      }
    }

    if (
      data.totalDiscountRate.trim() &&
      (!/^\d+(\.\d+)?$/.test(data.totalDiscountRate) ||
        Number(data.totalDiscountRate) < 0 ||
        Number(data.totalDiscountRate) > 100)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["totalDiscountRate"],
        message: "할인율은 0~100 사이의 숫자로 입력해주세요.",
      });
    }

    if (data.paymentMethod === "bank_transfer") {
      if (data.cashReceiptType && data.taxInvoiceRequested) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["taxInvoiceRequested"],
          message: "현금영수증과 세금계산서는 중복 선택할 수 없습니다.",
        });
      }

      if (!data.cashReceiptType && !data.taxInvoiceRequested) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cashReceiptType"],
          message: "현금영수증 또는 세금계산서 중 하나를 선택해주세요.",
        });
      }

      if (
        data.cashReceiptType === "income_deduction" &&
        !phoneRegex.test(data.cashReceiptPhone)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cashReceiptPhone"],
          message: "현금영수증 휴대폰번호는 010-0000-0000 형식으로 입력해주세요.",
        });
      }

      if (
        data.cashReceiptType === "expense_proof" &&
        !businessNumberRegex.test(data.cashReceiptBusinessNumber)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cashReceiptBusinessNumber"],
          message: "사업자등록번호는 000-00-00000 형식으로 입력해주세요.",
        });
      }

      if (data.taxInvoiceRequested) {
        if (!data.taxInvoiceEmail) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["taxInvoiceEmail"],
            message: "세금계산서 수령 이메일을 입력해주세요.",
          });
        } else if (!emailRegex.test(data.taxInvoiceEmail)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["taxInvoiceEmail"],
            message: "유효한 이메일 주소를 입력해주세요.",
          });
        }
      }
    }

    if (data.paymentMethod !== "bank_transfer" && data.taxInvoiceRequested) {
      if (!data.taxInvoiceEmail) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["taxInvoiceEmail"],
          message: "세금계산서 수령 이메일을 입력해주세요.",
        });
      } else if (!emailRegex.test(data.taxInvoiceEmail)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["taxInvoiceEmail"],
          message: "유효한 이메일 주소를 입력해주세요.",
        });
      }
    }
  });

export { contractFormSchema };

export type ContractFormSchemaValues = z.infer<typeof contractFormSchema>;

export type ValidatedContractFormValues = ContractFormSchemaValues & {
  writtenDate: string;
  agreementDate: string;
};

export function formatValidationErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path
      .map((segment) => (typeof segment === "number" ? String(segment) : segment))
      .join(".");

    if (!errors[field]) {
      errors[field] = issue.message;
    }
  }

  return errors;
}

export function validateContractForm(values: ContractFormValues):
  | { valid: true; data: ValidatedContractFormValues }
  | { valid: false; errors: Record<string, string> } {
  const result = contractFormSchema.safeParse(values);

  if (result.success) {
    return {
      valid: true,
      data: {
        ...result.data,
        writtenDate: buildDateString(
          result.data.writtenDateYear,
          result.data.writtenDateMonth,
          result.data.writtenDateDay,
        ),
        agreementDate: buildDateString(
          result.data.agreementDateYear,
          result.data.agreementDateMonth,
          result.data.agreementDateDay,
        ),
      },
    };
  }

  return {
    valid: false,
    errors: formatValidationErrors(result.error),
  };
}

export type PurchaseContractPayload = ValidatedContractFormValues;
