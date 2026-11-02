import { z } from "zod";

const phoneRegex = /^010-\d{4}-\d{4}$/;
const businessNumberRegex = /^\d{3}-\d{2}-\d{5}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const postalCodeRegex = /^\d{5}$/;
const amountRegex = /^\d+$/;

export const PRODUCT_ROW_COUNT = 10;

export type ProductRow = {
  name: string;
  type: string;
  color: string;
  size: string;
  quantity: string;
  unitPrice: string;
  // 개별 할인율(%). 구 계약 payload에는 없을 수 있음
  discountRate?: string;
  remarks: string;
};

export function createEmptyProductRow(): ProductRow {
  return {
    name: "",
    type: "",
    color: "",
    size: "",
    quantity: "",
    unitPrice: "",
    discountRate: "",
    remarks: "",
  };
}

// 상품명·컬러·사이즈 어디에든 사이즈가 들어간다("크림베이지 2호 200X300"). 1.5호는 제외
// 러그는 "N호 가로X세로"라 치수까지 본다. 커튼 호수("3호 / 민자")가 걸리지 않게 하기 위함
// 베르데·ORDER-MADE처럼 호 없이 치수만 있는 상품은 치수로 본다(4호는 3호 이상에도 포함)
const RUG_SIZE_3_BOX = String.raw`240\s*[Xx×]\s*3[2-5]0`; // 240X320~350
const RUG_SIZE_4_BOX = String.raw`(?:290|300)\s*[Xx×]\s*400`; // 로브 290X400, 그 외 300X400
// 원형 300은 포장 후 한 변이 200 초과라 3호 이상(반품 불가). 4호 배송 동의는 확인 전이라 넣지 않음
const RUG_ROUND_300 = String.raw`원형\s*300(?!\d)`;

function hasRugSize(products: ProductRow[], sizes: string, boxes: string[]): boolean {
  const pattern = new RegExp(
    [`(?<![\\d.])[${sizes}]호\\s*\\d+\\s*[Xx×]`, ...boxes].join("|"),
  );
  return products.some(
    (product) =>
      product.name.trim() &&
      pattern.test(`${product.name} ${product.color} ${product.size}`),
  );
}

// 사이즈는 반호~4호까지만 있어 3호 이상 = 3호·4호
export function getRugSizeNotices(products: ProductRow[]) {
  return {
    noReturn: hasRugSize(products, "34", [RUG_SIZE_3_BOX, RUG_SIZE_4_BOX, RUG_ROUND_300]),
    // 주문 제작은 러그·침구 상관없이 사이즈와 무관하게 반품 불가
    orderMade: products.some((product) => /ORDER-?MADE/i.test(product.name)),
    size4Delivery: hasRugSize(products, "4", [RUG_SIZE_4_BOX]),
  };
}

// label은 굵게, detail은 그 뒤에 보통 글씨로 이어 붙인다
export const RUG_NOTICE_TEXT = {
  noReturn: {
    title: "3호 이상 러그 교환·반품 불가 확인",
    label: "러그 3호 이상(주문 제작 사이즈 포함) 및 주문 제작 상품은 교환 및 반품이 불가합니다.",
    detail: "",
  },
  orderMade: {
    title: "주문 제작 상품 교환·반품 불가 확인",
    label: "주문 제작 상품은 교환 및 반품이 불가합니다.",
    detail: "",
  },
  // 러그 3호 이상과 주문 제작을 같이 사면 체크 하나로 합친다. 문구는 둘 다 담은 3호 문구 그대로
  noReturnOrderMade: {
    title: "3호 이상 러그 및 주문 제작 상품 교환·반품 불가 확인",
    label: "러그 3호 이상(주문 제작 사이즈 포함) 및 주문 제작 상품은 교환 및 반품이 불가합니다.",
    detail: "",
  },
  size4Delivery: {
    title: "4호 러그 배송 동의",
    label:
      "러그 4호 구매 시, 배송 전 엘리베이터 내부 규격 확인이 필요하며 해당 규격에 따른 배송 가능 여부를 반드시 확인해 주셔야 합니다.",
    detail:
      "엘리베이터에 대각선 방향으로 3m 길이가 충분히 들어갈 수 있는 건물에 한해서만 배송이 가능하며, 배송 기사님께서 엘리베이터에 실을 때에 도움을 요청하실 수도 있는 점 참고 부탁드립니다.",
  },
} as const;

// 화면에 띄울 동의 체크 목록. 교환·반품 불가는 3호 이상·주문 제작 중 무엇이든 체크 하나(largeRugNoticeAgreed)
export function getRugNoticeChecks(products: ProductRow[]) {
  const notices = getRugSizeNotices(products);
  const noReturnText =
    notices.noReturn && notices.orderMade
      ? RUG_NOTICE_TEXT.noReturnOrderMade
      : notices.noReturn
        ? RUG_NOTICE_TEXT.noReturn
        : RUG_NOTICE_TEXT.orderMade;

  return [
    (notices.noReturn || notices.orderMade) && {
      field: "largeRugNoticeAgreed" as const,
      ...noReturnText,
    },
    notices.size4Delivery && {
      field: "size4DeliveryAgreed" as const,
      ...RUG_NOTICE_TEXT.size4Delivery,
    },
  ].filter((item) => item !== false);
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
  // 미끄럼방지 패드 구매 여부. 계약서 작성 화면에서만 필수(커튼 주문서는 없음)
  padPurchased?: boolean | null;
  padQuantity?: string;
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
  // 러그 3호 이상 교환·반품 불가 / 4호 배송 동의 체크. 해당 사이즈를 고를 때만 받는다
  largeRugNoticeAgreed?: boolean;
  size4DeliveryAgreed?: boolean;
  termsAgreed: boolean;
  marketingConsentAgreed: boolean;
  // 배송·교환·반품 안내문에 펜으로 표시한 선(NoticeSheet 기준 좌표). 필기가 없으면 없음
  noticeAnnotation?: { strokes: { tool: "pen" | "highlighter"; points: [number, number][] }[] };
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
  type: z.string().trim().default(""),
  color: z.string().trim(),
  size: z.string().trim(),
  quantity: z.string().trim(),
  unitPrice: z.string().trim(),
  discountRate: z.string().trim().optional(),
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
    largeRugNoticeAgreed: z.boolean().optional(),
    size4DeliveryAgreed: z.boolean().optional(),
    // 필수 여부는 계약서 작성 화면에서 확인한다. 여기 없으면 제출 시 값이 빠져 저장되지 않는다
    padPurchased: z.boolean().nullable().optional(),
    padQuantity: z.string().trim().optional(),
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

      const discountRate = product.discountRate?.trim() ?? "";
      if (
        discountRate &&
        (!/^\d+(\.\d+)?$/.test(discountRate) || Number(discountRate) > 100)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["products", index, "discountRate"],
          message: "할인율은 0~100 사이의 숫자로 입력해주세요.",
        });
      }
    }

    const rugNotices = getRugSizeNotices(data.products);
    if ((rugNotices.noReturn || rugNotices.orderMade) && !data.largeRugNoticeAgreed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["largeRugNoticeAgreed"],
        message: "교환·반품 불가 안내에 동의해주세요.",
      });
    }
    if (rugNotices.size4Delivery && !data.size4DeliveryAgreed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["size4DeliveryAgreed"],
        message: "4호 러그 배송 안내에 동의해주세요.",
      });
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
