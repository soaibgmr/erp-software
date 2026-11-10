import { Router } from "express";
import { businessUpdateSchema } from "@erp-software/shared";
import { container } from "../../config/inversify.config";
import { TYPES } from "../../config/ioc.types";
import type { AuthMiddleware } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import type { BusinessController } from "./business.controller";

const controller = container.get<BusinessController>(TYPES.BusinessController);
const { requireAuth, requirePermission } = container.get<AuthMiddleware>(TYPES.AuthMiddleware);

export const businessRouter = Router();

businessRouter.use(requireAuth);

// Every signed-in user can read it: it's printed on invoices and shown in the shell.
businessRouter.get("/", controller.get);
businessRouter.patch(
  "/",
  requirePermission("settings.manage"),
  validate({ body: businessUpdateSchema }),
  controller.update,
);
