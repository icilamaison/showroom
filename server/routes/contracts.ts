import { Router } from "express";
import { sendError, sendSuccess } from "../lib/api-response";
import { requireAdminAuth } from "../middleware/auth";
import { parseContractInput } from "../schemas/contract.schema";
import { createContract } from "../services/contract.service";

const contractsRouter = Router();

contractsRouter.post("/", requireAdminAuth, async (req, res) => {
  const parsed = parseContractInput(req.body);

  if (!parsed.success) {
    return sendError(res, "입력값을 확인해주세요.", 400, parsed.errors);
  }

  try {
    const result = await createContract(parsed.data, req.body);
    return sendSuccess(res, result, 201);
  } catch (error) {
    console.error("[contracts] Failed to create contract:", error);
    return sendError(res, "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", 500);
  }
});

export default contractsRouter;
