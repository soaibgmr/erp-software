import { Router } from "express";
import { container } from "../../config/inversify.config";
import { TYPES } from "../../config/ioc.types";
import { idParamSchema } from "../../common/schemas";
import type { AuthMiddleware } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import type { ShiftController } from "./shift.controller";
import { closeShiftSchema, listShiftsQuerySchema, openShiftSchema } from "./shift.schema";

const controller = container.get<ShiftController>(TYPES.ShiftController);
const { requireAuth, requirePermission, requireBranch } = container.get<AuthMiddleware>(TYPES.AuthMiddleware);
const counter = requirePermission("pos.use", "report.view");

export const shiftsRouter = Router();

shiftsRouter.use(requireAuth, counter);

shiftsRouter.get("/current", requireBranch, controller.current);
shiftsRouter.get("/", requireBranch, validate({ query: listShiftsQuerySchema }), controller.list);
shiftsRouter.post(
  "/open",
  requirePermission("pos.use"),
  requireBranch,
  validate({ body: openShiftSchema }),
  controller.open,
);
shiftsRouter.post(
  "/:id/close",
  requireBranch,
  validate({ params: idParamSchema, body: closeShiftSchema }),
  controller.close,
);
shiftsRouter.get("/:id/report", validate({ params: idParamSchema }), controller.report);
