import { Router } from "express";
import { container } from "../../config/inversify.config";
import { TYPES } from "../../config/ioc.types";
import { idParamSchema } from "../../common/schemas";
import type { AuthMiddleware } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import type { LabourServiceController } from "./labour-service.controller";
import {
  createLabourServiceSchema,
  listLabourServicesQuerySchema,
  updateLabourServiceSchema,
} from "./labour-service.schema";

const controller = container.get<LabourServiceController>(TYPES.LabourServiceController);
const { requireAuth, requirePermission } = container.get<AuthMiddleware>(TYPES.AuthMiddleware);
// The POS picks labour from this list.
const view = requirePermission("inventory.view", "inventory.manage", "pos.use");
const manage = requirePermission("inventory.manage");

export const labourServicesRouter = Router();

labourServicesRouter.use(requireAuth);

labourServicesRouter.get("/", view, validate({ query: listLabourServicesQuerySchema }), controller.list);
labourServicesRouter.get("/:id", view, validate({ params: idParamSchema }), controller.getById);
labourServicesRouter.post("/", manage, validate({ body: createLabourServiceSchema }), controller.create);
labourServicesRouter.patch(
  "/:id",
  manage,
  validate({ params: idParamSchema, body: updateLabourServiceSchema }),
  controller.update,
);
labourServicesRouter.delete("/:id", manage, validate({ params: idParamSchema }), controller.remove);
