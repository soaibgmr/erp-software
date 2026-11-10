import { Router } from "express";
import { container } from "../../config/inversify.config";
import { TYPES } from "../../config/ioc.types";
import { idParamSchema } from "../../common/schemas";
import type { AuthMiddleware } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import type { BranchController } from "./branch.controller";
import { createBranchSchema, listBranchesQuerySchema, updateBranchSchema } from "./branch.schema";

const controller = container.get<BranchController>(TYPES.BranchController);
const { requireAuth, requirePermission } = container.get<AuthMiddleware>(TYPES.AuthMiddleware);
const manage = requirePermission("branch.manage");

export const branchesRouter = Router();

branchesRouter.use(requireAuth);

// Reads are scoped to the user's own branches in the service.
branchesRouter.get("/", validate({ query: listBranchesQuerySchema }), controller.list);
branchesRouter.get("/:id", validate({ params: idParamSchema }), controller.getById);

branchesRouter.post("/", manage, validate({ body: createBranchSchema }), controller.create);
branchesRouter.patch("/:id", manage, validate({ params: idParamSchema, body: updateBranchSchema }), controller.update);
branchesRouter.delete("/:id", manage, validate({ params: idParamSchema }), controller.remove);
