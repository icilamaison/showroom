import type { NextFunction, Request, Response } from "express";
import { sendError } from "../lib/api-response";
import {
  ADMIN_TOKEN_COOKIE,
  type AdminTokenPayload,
  verifyAdminToken,
} from "../services/auth.service";

declare global {
  namespace Express {
    interface Request {
      admin?: AdminTokenPayload;
    }
  }
}

export function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = req.cookies?.[ADMIN_TOKEN_COOKIE] as string | undefined;

  if (!token) {
    sendError(res, "인증이 필요합니다.", 401);
    return;
  }

  try {
    req.admin = verifyAdminToken(token);
    next();
  } catch {
    sendError(res, "인증이 만료되었거나 유효하지 않습니다.", 401);
    return;
  }
}
