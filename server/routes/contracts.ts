import { Router } from "express";
import { sendError, sendSuccess } from "../lib/api-response";
import { requireAdminAuth } from "../middleware/auth";
import { parseContractInput } from "../schemas/contract.schema";
import { createContract } from "../services/contract.service";
import { getContractByNumberAndToken } from "../services/admin-contract.service";

const contractsRouter = Router();

// 고객이 로그인 없이 자신의 계약서를 웹으로 확인하는 공개 조회 (계약번호+토큰 모두 일치해야 조회 가능)
contractsRouter.get("/public/:contractNumber", async (req, res) => {
  const { contractNumber } = req.params;
  const token = typeof req.query.token === "string" ? req.query.token : "";

  if (!token) {
    return sendError(res, "계약서를 찾을 수 없습니다.", 404);
  }

  try {
    const contract = await getContractByNumberAndToken(contractNumber, token);

    if (!contract) {
      return sendError(res, "계약서를 찾을 수 없습니다.", 404);
    }

    return sendSuccess(res, contract);
  } catch (error) {
    console.error("[contracts] Failed to get public contract:", error);
    return sendError(res, "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", 500);
  }
});

contractsRouter.post("/", requireAdminAuth, async (req, res) => {
  const parsed = parseContractInput(req.body);

  if (!parsed.success) {
    return sendError(res, "입력값을 확인해주세요.", 400, parsed.errors);
  }

  try {
    const result = await createContract(parsed.data, req.body, req.admin!.adminId);
    return sendSuccess(res, result, 201);
  } catch (error) {
    console.error("[contracts] Failed to create contract:", error);
    return sendError(res, "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", 500);
  }
});

export default contractsRouter;
