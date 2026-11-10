import { Router } from "express";
import { container } from "../../config/inversify.config";
import { TYPES } from "../../config/ioc.types";
import { idParamSchema } from "../../common/schemas";
import type { AuthMiddleware } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import type { StockController } from "./stock.controller";
import {
  createAdjustmentSchema,
  createTransferSchema,
  importSchema,
  itemIdParamSchema,
  ledgerQuerySchema,
  listAdjustmentsQuerySchema,
  listStockQuerySchema,
  listTransfersQuerySchema,
  rejectAdjustmentSchema,
  updateStockSettingsSchema,
} from "./stock.schema";

const controller = container.get<StockController>(TYPES.StockController);
const { requireAuth, requirePermission, requireBranch, optionalBranch } = container.get<AuthMiddleware>(
  TYPES.AuthMiddleware,
);
const view = requirePermission("inventory.view", "inventory.manage");
const manage = requirePermission("inventory.manage");
const approve = requirePermission("stock.approve");

export const stockRouter = Router();

stockRouter.use(requireAuth);

// Levels and ledger. Reads take the branch from the header or ?branchId=.
stockRouter.get("/", view, optionalBranch, validate({ query: listStockQuerySchema }), controller.list);

// Adjustments and transfers act on the current branch (x-branch-id).
stockRouter.get(
  "/adjustments",
  view,
  requireBranch,
  validate({ query: listAdjustmentsQuerySchema }),
  controller.listAdjustments,
);
stockRouter.post(
  "/adjustments",
  manage,
  requireBranch,
  validate({ body: createAdjustmentSchema }),
  controller.createAdjustment,
);
stockRouter.get("/adjustments/:id", view, validate({ params: idParamSchema }), controller.getAdjustment);
stockRouter.post(
  "/adjustments/:id/approve",
  approve,
  requireBranch,
  validate({ params: idParamSchema }),
  controller.approveAdjustment,
);
stockRouter.post(
  "/adjustments/:id/reject",
  approve,
  requireBranch,
  validate({ params: idParamSchema, body: rejectAdjustmentSchema }),
  controller.rejectAdjustment,
);

stockRouter.get(
  "/transfers",
  view,
  requireBranch,
  validate({ query: listTransfersQuerySchema }),
  controller.listTransfers,
);
stockRouter.post(
  "/transfers",
  manage,
  requireBranch,
  validate({ body: createTransferSchema }),
  controller.createTransfer,
);
stockRouter.get("/transfers/:id", view, validate({ params: idParamSchema }), controller.getTransfer);
stockRouter.post(
  "/transfers/:id/receive",
  manage,
  requireBranch,
  validate({ params: idParamSchema }),
  controller.receiveTransfer,
);
stockRouter.post(
  "/transfers/:id/cancel",
  manage,
  requireBranch,
  validate({ params: idParamSchema }),
  controller.cancelTransfer,
);

// The body limit for this path is raised in app.ts.
stockRouter.post("/import", manage, requireBranch, validate({ body: importSchema }), controller.import);

// /:itemId routes last so they don't capture /adjustments, /transfers or /import.
stockRouter.get(
  "/:itemId/ledger",
  view,
  optionalBranch,
  validate({ params: itemIdParamSchema, query: ledgerQuerySchema }),
  controller.ledger,
);
stockRouter.patch(
  "/:itemId/settings",
  manage,
  requireBranch,
  validate({ params: itemIdParamSchema, body: updateStockSettingsSchema }),
  controller.updateSettings,
);
