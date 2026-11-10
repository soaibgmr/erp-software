import { inject, injectable } from "inversify";
import type { Request, Response } from "express";
import { TYPES } from "../../config/ioc.types";
import { sendCreated, sendPaginated, sendSuccess } from "../../common/api-response";
import type { ILabourServiceService } from "./interfaces/ilabour-service.service";

@injectable()
export class LabourServiceController {
  constructor(@inject(TYPES.LabourServiceService) private readonly services: ILabourServiceService) {}

  list = async (_req: Request, res: Response) => {
    sendPaginated(res, await this.services.list(res.locals.query));
  };

  getById = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.services.getById(res.locals.params.id));
  };

  create = async (_req: Request, res: Response) => {
    sendCreated(res, await this.services.create(res.locals.auth, res.locals.body), "Labour service created");
  };

  update = async (_req: Request, res: Response) => {
    const row = await this.services.update(res.locals.auth, res.locals.params.id, res.locals.body);
    sendSuccess(res, row, { message: "Labour service updated" });
  };

  remove = async (_req: Request, res: Response) => {
    await this.services.remove(res.locals.auth, res.locals.params.id);
    sendSuccess(res, null, { message: "Labour service deleted" });
  };
}
