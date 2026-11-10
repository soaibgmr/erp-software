import { Router } from "express";
import { container } from "../../config/inversify.config";
import { TYPES } from "../../config/ioc.types";
import type { AuthMiddleware } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import type { AuditController } from "./audit.controller";
import { listAuditLogsQuerySchema } from "./audit.schema";

const controller = container.get<AuditController>(TYPES.AuditController);
const { requireAuth, requirePermission } = container.get<AuthMiddleware>(TYPES.AuthMiddleware);

export const auditRouter = Router();

auditRouter.get(
  "/",
  requireAuth,
  requirePermission("audit.view"),
  validate({ query: listAuditLogsQuerySchema }),
  controller.list,
);
