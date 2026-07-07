import { Router } from "express";
import { sendError, sendSuccess } from "../../lib/api-response";
import { parseContractStatusUpdate } from "../../schemas/admin.schema";
import {
  getContractById,
  listContracts,
  updateContractStatus,
} from "../../services/admin-contract.service";
import {
  buildOrderExcelFilename,
  generateOrderExcelBuffer,
  OrderExcelGenerationError,
} from "../../services/order-excel.service";

const contractsRouter = Router();

contractsRouter.get("/", async (req, res) => {
  try {
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const result = await listContracts({
      customerName:
        typeof req.query.customerName === "string"
          ? req.query.customerName
          : undefined,
      customerPhone:
        typeof req.query.customerPhone === "string"
          ? req.query.customerPhone
          : undefined,
      status:
        typeof req.query.status === "string" ? req.query.status : undefined,
      page: Number.isFinite(page) ? page : undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
    });

    return sendSuccess(res, result);
  } catch (error) {
    console.error("[admin/contracts] Failed to list contracts:", error);
    return sendError(res, "서버 오류가 발생했습니다.", 500);
  }
});

contractsRouter.get("/:id/order-excel", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return sendError(res, "유효하지 않은 계약서 ID입니다.", 400);
  }

  try {
    const contract = await getContractById(id);

    if (!contract) {
      return sendError(res, "계약서를 찾을 수 없습니다.", 404);
    }

    const buffer = await generateOrderExcelBuffer(contract);
    const filename = buildOrderExcelFilename(contract.contractNumber);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );

    return res.send(buffer);
  } catch (error) {
    if (error instanceof OrderExcelGenerationError) {
      return sendError(res, error.message, 400);
    }

    console.error("[admin/contracts] Failed to generate order excel:", error);
    return sendError(res, "서버 오류가 발생했습니다.", 500);
  }
});

contractsRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return sendError(res, "유효하지 않은 계약서 ID입니다.", 400);
  }

  try {
    const contract = await getContractById(id);

    if (!contract) {
      return sendError(res, "계약서를 찾을 수 없습니다.", 404);
    }

    return sendSuccess(res, contract);
  } catch (error) {
    console.error("[admin/contracts] Failed to get contract:", error);
    return sendError(res, "서버 오류가 발생했습니다.", 500);
  }
});

contractsRouter.patch("/:id/status", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return sendError(res, "유효하지 않은 계약서 ID입니다.", 400);
  }

  const parsed = parseContractStatusUpdate(req.body);

  if (!parsed.success) {
    return sendError(res, parsed.message, 400);
  }

  try {
    const updated = await updateContractStatus(id, parsed.data.status);

    if (!updated) {
      return sendError(res, "계약서를 찾을 수 없습니다.", 404);
    }

    return sendSuccess(res, updated);
  } catch (error) {
    console.error("[admin/contracts] Failed to update contract status:", error);
    return sendError(res, "서버 오류가 발생했습니다.", 500);
  }
});

export default contractsRouter;
