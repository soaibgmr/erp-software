import { Router } from "express";
import { container } from "../../config/inversify.config";
import { TYPES } from "../../config/ioc.types";
import { idParamSchema } from "../../common/schemas";
import type { AuthMiddleware } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import type { RoleController } from "./role.controller";
import { createRoleSchema, updateRoleSchema } from "./role.schema";

const controller = container.get<RoleController>(TYPES.RoleController);
const { requireAuth, requirePermission } = container.get<AuthMiddleware>(TYPES.AuthMiddleware);
const manage = requirePermission("role.manage");

export const permissionsRouter = Router();
permissionsRouter.get("/", requireAuth, controller.permissions);

export const rolesRouter = Router();

rolesRouter.use(requireAuth);

// The user form needs the role list, so user managers can read roles too.
rolesRouter.get("/", requirePermission("role.manage", "user.manage"), controller.list);
rolesRouter.get(
  "/:id",
  requirePermission("role.manage", "user.manage"),
  validate({ params: idParamSchema }),
  controller.getById,
);

rolesRouter.post("/", manage, validate({ body: createRoleSchema }), controller.create);
rolesRouter.patch("/:id", manage, validate({ params: idParamSchema, body: updateRoleSchema }), controller.update);
rolesRouter.delete("/:id", manage, validate({ params: idParamSchema }), controller.remove);
