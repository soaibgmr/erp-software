import { Router } from "express";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { sendError, sendSuccess } from "../../common/api-response";

export const healthRouter = Router();

// Also reports the app timezone, so clients take it from here instead of configuring their own copy.
healthRouter.get("/", (req, res) => {
  sendSuccess(res, { status: "ok", timezone: env.APP_TIMEZONE });
});

healthRouter.get("/db", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    sendSuccess(res, { status: "ok", database: "up" });
  } catch {
    sendError(res, 503, "DB_UNAVAILABLE", "Database is down");
  }
});
