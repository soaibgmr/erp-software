import { inject, injectable } from "inversify";
import type { Request, Response } from "express";
import { TYPES } from "../../config/ioc.types";
import { sendSuccess } from "../../common/api-response";
import type { ISettingsService } from "./interfaces/isettings.service";

@injectable()
export class SettingsController {
  constructor(@inject(TYPES.SettingsService) private readonly settingsService: ISettingsService) {}

  getAll = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.settingsService.getAll(res.locals.auth.businessId));
  };

  get = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.settingsService.get(res.locals.auth.businessId, res.locals.params.group));
  };

  // The body is validated in the service, against the schema of the group in the path.
  update = async (req: Request, res: Response) => {
    sendSuccess(res, await this.settingsService.update(res.locals.auth, res.locals.params.group, req.body), {
      message: "Settings saved",
    });
  };
}
