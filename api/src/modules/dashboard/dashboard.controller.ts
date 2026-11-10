import { inject, injectable } from "inversify";
import type { Request, Response } from "express";
import { TYPES } from "../../config/ioc.types";
import { sendSuccess } from "../../common/api-response";
import type { IDashboardService } from "./interfaces/idashboard.service";

@injectable()
export class DashboardController {
  constructor(@inject(TYPES.DashboardService) private readonly dashboard: IDashboardService) {}

  summary = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.dashboard.summary(res.locals.auth, res.locals.branchId, res.locals.query));
  };

  salesTrend = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.dashboard.salesTrend(res.locals.auth, res.locals.branchId, res.locals.query));
  };

  lowStock = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.dashboard.lowStock(res.locals.auth, res.locals.branchId, res.locals.query));
  };
}
