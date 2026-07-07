import { Router } from "express";
import { parseContractListQuery } from "../../lib/contract-list-query";
import { sendError, sendSuccess } from "../../lib/api-response";
import { parseContractStatusUpdate } from "../../schemas/admin.schema";
import {
  getContractById,
  listContracts,
  listContractsForExport,
  updateContractStatus,
} from "../../services/admin-contract.service";
import {
  buildBulkOrderExcelFilename,
  buildOrderExcelFilename,
  generateBulkOrderExcelBuffer,
  generateOrderExcelBuffer,
  OrderExcelGenerationError,
} from "../../services/order-excel.service";

const contractsRouter = Router();

function sendExcelFile(
  res: Parameters<typeof sendSuccess>[0],
  buffer: Buffer,
  filename: string,
) {
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );

  return res.send(buffer);
}

contractsRouter.get("/", async (req, res) => {
  try {
    const parsed = parseContractListQuery(req.query);

    if (parsed.error) {
      return sendError(res, parsed.error, 400);
    }

    const result = await listContracts(parsed.filters);

    return sendSuccess(res, result);
  } catch (error) {
    console.error("[admin/contracts] Failed to list contracts:", error);
    return sendError(res, "서버 오류가 발생했습니다.", 500);
  }
});

contractsRouter.get("/order-excel", async (req, res) => {
  try {
    const parsed = parseContractListQuery(req.query);

    if (parsed.error) {
      return sendError(res, parsed.error, 400);
    }

    const { page: _page, limit: _limit, ...exportFilters } = parsed.filters;
    const contracts = await listContractsForExport(exportFilters);
    const buffer = await generateBulkOrderExcelBuffer(contracts);
    const filename = buildBulkOrderExcelFilename(
      exportFilters.dateFrom,
      exportFilters.dateTo,
    );

    return sendExcelFile(res, buffer, filename);
  } catch (error) {
    if (error instanceof OrderExcelGenerationError) {
      return sendError(res, error.message, 400);
    }

    console.error("[admin/contracts] Failed to generate bulk order excel:", error);
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

    return sendExcelFile(res, buffer, filename);
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
