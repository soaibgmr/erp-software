import { inject, injectable } from "inversify";
import type { Request, Response } from "express";
import { TYPES } from "../../config/ioc.types";
import { sendCreated, sendPaginated, sendSuccess } from "../../common/api-response";
import type { IShiftService } from "./interfaces/ishift.service";

@injectable()
export class ShiftController {
  constructor(@inject(TYPES.ShiftService) private readonly shifts: IShiftService) {}

  // 200 with data: null when the user has no open shift, so the POS can offer "Open shift".
  current = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.shifts.current(res.locals.auth, res.locals.branchId));
  };

  list = async (_req: Request, res: Response) => {
    sendPaginated(res, await this.shifts.list(res.locals.auth, res.locals.branchId, res.locals.query));
  };

  open = async (_req: Request, res: Response) => {
    sendCreated(res, await this.shifts.open(res.locals.auth, res.locals.branchId, res.locals.body), "Shift opened");
  };

  close = async (_req: Request, res: Response) => {
    const report = await this.shifts.close(res.locals.auth, res.locals.branchId, res.locals.params.id, res.locals.body);
    sendSuccess(res, report, { message: "Shift closed" });
  };

  report = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.shifts.report(res.locals.auth, res.locals.params.id));
  };
}
