import { Router } from "express";
import { z } from "zod";
import { reportQuerySchema, tallyExportQuerySchema } from "@automobile/shared";
import { container } from "../../config/inversify.config";
import { TYPES } from "../../config/ioc.types";
import type { AuthMiddleware } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import type { ReportController } from "./report.controller";

const controller = container.get<ReportController>(TYPES.ReportController);
const { requireAuth, requirePermission, optionalBranch } = container.get<AuthMiddleware>(TYPES.AuthMiddleware);

export const reportsRouter = Router();

reportsRouter.use(requireAuth, requirePermission("report.view"), optionalBranch);

reportsRouter.get("/", validate({}), controller.catalog);
// Registered before /:name so "tally-export" isn't read as a report name.
reportsRouter.get("/tally-export", validate({ query: tallyExportQuerySchema }), controller.tally);
reportsRouter.get(
  "/:name",
  validate({ params: z.object({ name: z.string().max(40) }), query: reportQuerySchema }),
  controller.run,
);
