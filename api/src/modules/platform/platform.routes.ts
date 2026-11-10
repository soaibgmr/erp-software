import { Router } from "express";
import { businessStatusUpdateSchema, platformLoginSchema } from "@erp-software/shared";
import { container } from "../../config/inversify.config";
import { TYPES } from "../../config/ioc.types";
import { idParamSchema } from "../../common/schemas";
import type { PlatformAuthMiddleware } from "../../middleware/platform-auth";
import { rateLimit } from "../../middleware/rate-limit";
import { validate } from "../../middleware/validate";
import type { PlatformController } from "./platform.controller";
import { listBusinessesQuerySchema } from "./platform.schema";

const controller = container.get<PlatformController>(TYPES.PlatformController);
const { requirePlatformAdmin } = container.get<PlatformAuthMiddleware>(TYPES.PlatformAuthMiddleware);

// The product owner's console: approve, reject and suspend registered shops. Never exposes shop data.
export const platformRouter = Router();

platformRouter.post(
  "/auth/login",
  rateLimit({ name: "platform-login", windowMs: 15 * 60_000, max: 10 }),
  validate({ body: platformLoginSchema }),
  controller.login,
);

platformRouter.use(requirePlatformAdmin);

platformRouter.get("/me", controller.me);
platformRouter.get("/businesses", validate({ query: listBusinessesQuerySchema }), controller.listBusinesses);
platformRouter.patch(
  "/businesses/:id/status",
  validate({ params: idParamSchema, body: businessStatusUpdateSchema }),
  controller.updateStatus,
);
