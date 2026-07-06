import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { verifyDatabaseConnection } from "./db/pool";
import apiRouter from "./routes";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin:
        process.env.NODE_ENV === "production"
          ? process.env.CLIENT_ORIGIN
          : "http://localhost:3000",
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  app.use("/api", apiRouter);

  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error("[server] Unhandled error:", err);
      res.status(500).json({
        success: false,
        message: "서버 오류가 발생했습니다.",
      });
    },
  );

  return app;
}

const PORT = Number(process.env.SERVER_PORT ?? 4000);
const app = createApp();

async function startServer(): Promise<void> {
  try {
    await verifyDatabaseConnection();
  } catch {
    console.warn(
      "[server] Database connection failed — API will start but DB operations will fail until configured.",
    );
  }

  app.listen(PORT, () => {
    console.log(`[server] Express running on http://localhost:${PORT}`);
    console.log(`[server] Next.js proxies /api/* → http://localhost:${PORT}/api/*`);
  });
}

if (require.main === module) {
  void startServer();
}

export default app;
