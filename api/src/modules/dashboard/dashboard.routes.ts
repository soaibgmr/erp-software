import { Router } from "express";
import { container } from "../../config/inversify.config";
import { TYPES } from "../../config/ioc.types";
import type { AuthMiddleware } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import type { DashboardController } from "./dashboard.controller";
import { dashboardSummaryQuerySchema, lowStockQuerySchema, salesTrendQuerySchema } from "./dashboard.schema";

const controller = container.get<DashboardController>(TYPES.DashboardController);
const { requireAuth, requirePermission, optionalBranch } = container.get<AuthMiddleware>(TYPES.AuthMiddleware);

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth, requirePermission("dashboard.view"), optionalBranch);

dashboardRouter.get("/summary", validate({ query: dashboardSummaryQuerySchema }), controller.summary);
dashboardRouter.get("/sales-trend", validate({ query: salesTrendQuerySchema }), controller.salesTrend);
dashboardRouter.get("/low-stock", validate({ query: lowStockQuerySchema }), controller.lowStock);
