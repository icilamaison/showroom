import { Router } from "express";
import { sendSuccess } from "../../lib/api-response";
import { requireAdminAuth } from "../../middleware/auth";
import { ADMIN_TOKEN_COOKIE } from "../../services/auth.service";
import authRouter from "./auth";
import contractsRouter from "./contracts";

const adminRouter = Router();

adminRouter.use("/login", authRouter);
adminRouter.post("/logout", (_req, res) => {
  res.clearCookie(ADMIN_TOKEN_COOKIE);
  return sendSuccess(res, null);
});
adminRouter.use(requireAdminAuth);
adminRouter.use("/contracts", contractsRouter);

export default adminRouter;
