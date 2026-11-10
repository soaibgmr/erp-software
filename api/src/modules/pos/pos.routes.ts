import { Router } from "express";
import { heldCartCreateSchema, quoteSchema } from "@automobile/shared";
import { container } from "../../config/inversify.config";
import { TYPES } from "../../config/ioc.types";
import { idParamSchema } from "../../common/schemas";
import type { AuthMiddleware } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import type { PosController } from "./pos.controller";

const controller = container.get<PosController>(TYPES.PosController);
const { requireAuth, requirePermission, requireBranch } = container.get<AuthMiddleware>(TYPES.AuthMiddleware);

export const posRouter = Router();

posRouter.use(requireAuth, requirePermission("pos.use", "invoice.create"), requireBranch);

posRouter.post("/quote", validate({ body: quoteSchema }), controller.quote);
posRouter.get("/held-carts", controller.listHeld);
posRouter.post("/held-carts", validate({ body: heldCartCreateSchema }), controller.hold);
posRouter.get("/held-carts/:id", validate({ params: idParamSchema }), controller.getHeld);
posRouter.delete("/held-carts/:id", validate({ params: idParamSchema }), controller.removeHeld);
