import { inject, injectable } from "inversify";
import type { Request, Response } from "express";
import { TYPES } from "../../config/ioc.types";
import { sendSuccess } from "../../common/api-response";
import type { IBusinessService } from "./interfaces/ibusiness.service";

@injectable()
export class BusinessController {
  constructor(@inject(TYPES.BusinessService) private readonly businessService: IBusinessService) {}

  get = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.businessService.get());
  };

  update = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.businessService.update(res.locals.auth, res.locals.body), {
      message: "Business profile updated",
    });
  };
}
