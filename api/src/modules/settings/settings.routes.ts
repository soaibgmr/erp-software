import { Router } from "express";
import { z } from "zod";
import { SETTINGS_GROUPS } from "@erp-software/shared";
import { container } from "../../config/inversify.config";
import { TYPES } from "../../config/ioc.types";
import type { AuthMiddleware } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import type { SettingsController } from "./settings.controller";

const controller = container.get<SettingsController>(TYPES.SettingsController);
const { requireAuth, requirePermission } = container.get<AuthMiddleware>(TYPES.AuthMiddleware);

export const groupParamSchema = z.object({ group: z.enum(SETTINGS_GROUPS) });

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

// Readable by every signed-in user: POS and print screens need them.
settingsRouter.get("/", controller.getAll);
settingsRouter.get("/:group", validate({ params: groupParamSchema }), controller.get);
settingsRouter.patch(
  "/:group",
  requirePermission("settings.manage"),
  validate({ params: groupParamSchema }),
  controller.update,
);
