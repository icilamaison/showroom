import { z } from "zod";

export const adminLoginSchema = z.object({
  username: z
    .string({ required_error: "아이디를 입력해주세요." })
    .trim()
    .min(1, "아이디를 입력해주세요."),
  password: z
    .string({ required_error: "비밀번호를 입력해주세요." })
    .min(1, "비밀번호를 입력해주세요."),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export function parseAdminLoginInput(body: unknown):
  | { success: true; data: AdminLoginInput }
  | { success: false; message: string } {
  const result = adminLoginSchema.safeParse(body);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    message: result.error.issues[0]?.message ?? "입력값을 확인해주세요.",
  };
}

export const CONTRACT_STATUSES = [
  "DRAFTING",
  "SUBMITTED",
  "REVIEWING",
  "ON_HOLD",
  "CONFIRMED",
  "CANCEL_PENDING",
  "CANCELED",
] as const;

export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const contractStatusUpdateSchema = z.object({
  status: z.enum(CONTRACT_STATUSES, {
    errorMap: () => ({
      message:
        "상태는 DRAFTING, SUBMITTED, REVIEWING, ON_HOLD, CONFIRMED, CANCEL_PENDING, CANCELED 중 하나여야 합니다.",
    }),
  }),
});

export type ContractStatusUpdateInput = z.infer<
  typeof contractStatusUpdateSchema
>;

export function parseContractStatusUpdate(body: unknown):
  | { success: true; data: ContractStatusUpdateInput }
  | { success: false; message: string } {
  const result = contractStatusUpdateSchema.safeParse(body);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    message: result.error.issues[0]?.message ?? "입력값을 확인해주세요.",
  };
}
