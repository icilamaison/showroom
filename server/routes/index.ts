import { Router } from "express";
import adminRouter from "./admin";
import contractsRouter from "./contracts";

const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ success: true, message: "ok" });
});

apiRouter.use("/contracts", contractsRouter);
apiRouter.use("/admin", adminRouter);

export default apiRouter;
