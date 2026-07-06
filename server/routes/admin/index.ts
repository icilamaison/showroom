import { Router } from "express";
import { requireAdminAuth } from "../../middleware/auth";
import authRouter from "./auth";
import contractsRouter from "./contracts";

const adminRouter = Router();

adminRouter.use("/login", authRouter);
adminRouter.use(requireAdminAuth);
adminRouter.use("/contracts", contractsRouter);

export default adminRouter;
