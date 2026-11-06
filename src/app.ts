import express, { Application, Request, Response } from "express";
import cors from "cors";
import { env } from "./config/env";
import healthRoutes from "./routes/health.routes";
import authRoutes from "./routes/auth.routes";

export function createApp(): Application {
  const app = express();

  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json());

  app.get("/", (req: Request, res: Response) => {
    res.status(200).json({
      message: "InvestCol API - Entrega 4",
      status: "online",
      environment: env.nodeEnv,
    });
  });

  app.use("/api", healthRoutes);
  app.use("/api/auth", authRoutes);

  return app;
}