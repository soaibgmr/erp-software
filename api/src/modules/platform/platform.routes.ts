import { Router } from "express";
import { businessStatusUpdateSchema, demoRequestSchema, platformLoginSchema } from "@erp-software/shared";
import { container } from "../../config/inversify.config";
import { TYPES } from "../../config/ioc.types";
import { idParamSchema } from "../../common/schemas";
import type { PlatformAuthMiddleware } from "../../middleware/platform-auth";
import { rateLimit } from "../../middleware/rate-limit";
import type { IAttemptLimiter } from "../../common/attempt-limiter";
import { validate } from "../../middleware/validate";
import type { PlatformController } from "./platform.controller";
import { demoRequestHandledSchema, listBusinessesQuerySchema, listDemoRequestsQuerySchema } from "./platform.schema";

const controller = container.get<PlatformController>(TYPES.PlatformController);
const { requirePlatformAdmin } = container.get<PlatformAuthMiddleware>(TYPES.PlatformAuthMiddleware);

// The product owner's console: approve, reject and suspend registered shops. Never exposes shop data.
export const platformRouter = Router();

platformRouter.post(
  "/auth/login",
  rateLimit(container.get<IAttemptLimiter>(TYPES.AttemptLimiter), {
    name: "platform-login",
    windowMs: 15 * 60_000,
    max: 10,
  }),
  validate({ body: platformLoginSchema }),
  controller.login,
);

// Public: "Book a quick demo" on the landing page. Limited per address so it can't be used to flood the inbox.
platformRouter.post(
  "/demo-requests",
  rateLimit(container.get<IAttemptLimiter>(TYPES.AttemptLimiter), {
    name: "demo-request",
    windowMs: 60 * 60_000,
    max: 5,
  }),
  validate({ body: demoRequestSchema }),
  controller.requestDemo,
);

platformRouter.use(requirePlatformAdmin);

platformRouter.get("/me", controller.me);
platformRouter.get("/businesses", validate({ query: listBusinessesQuerySchema }), controller.listBusinesses);
platformRouter.patch(
  "/businesses/:id/status",
  validate({ params: idParamSchema, body: businessStatusUpdateSchema }),
  controller.updateStatus,
);
platformRouter.get("/demo-requests", validate({ query: listDemoRequestsQuerySchema }), controller.listDemoRequests);
platformRouter.patch(
  "/demo-requests/:id",
  validate({ params: idParamSchema, body: demoRequestHandledSchema }),
  controller.setDemoRequestHandled,
);
