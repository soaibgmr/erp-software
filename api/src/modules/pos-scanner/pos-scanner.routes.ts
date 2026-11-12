import { Router } from "express";
import { container } from "../../config/inversify.config";
import { TYPES } from "../../config/ioc.types";
import type { IAttemptLimiter } from "../../common/attempt-limiter";
import type { AuthMiddleware } from "../../middleware/auth";
import { rateLimit } from "../../middleware/rate-limit";
import { validate } from "../../middleware/validate";
import type { PosScannerController } from "./pos-scanner.controller";
import { scanEventCreateSchema, scanPollQuerySchema, scanSessionParamSchema } from "./pos-scanner.schema";

const controller = container.get<PosScannerController>(TYPES.PosScannerController);
const { requireAuth, requirePermission, requireBranch } = container.get<AuthMiddleware>(TYPES.AuthMiddleware);

// Counter PC: pair a phone, poll its scans, end it. Mounted at /pos/scan-sessions (before /pos).
export const posScanSessionsRouter = Router();

posScanSessionsRouter.use(requireAuth, requirePermission("pos.use", "invoice.create"), requireBranch);

posScanSessionsRouter.post("/", controller.create);
posScanSessionsRouter.get(
  "/:id/scans",
  validate({ params: scanSessionParamSchema, query: scanPollQuerySchema }),
  controller.poll,
);
posScanSessionsRouter.delete("/:id", validate({ params: scanSessionParamSchema }), controller.end);

// Phone: no login, only the session token from the QR code (x-scan-token). Mounted at /scan-sessions.
export const phoneScannerRouter = Router();

const phoneLimit = rateLimit(container.get<IAttemptLimiter>(TYPES.AttemptLimiter), {
  name: "phone-scanner",
  windowMs: 60_000,
  max: 120,
});

phoneScannerRouter.post("/:id/ping", phoneLimit, validate({ params: scanSessionParamSchema }), controller.ping);
phoneScannerRouter.post(
  "/:id/scans",
  phoneLimit,
  validate({ params: scanSessionParamSchema, body: scanEventCreateSchema }),
  controller.scan,
);
