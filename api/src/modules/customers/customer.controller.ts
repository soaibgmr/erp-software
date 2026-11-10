import { inject, injectable } from "inversify";
import type { Request, Response } from "express";
import { TYPES } from "../../config/ioc.types";
import { sendCreated, sendPaginated, sendSuccess } from "../../common/api-response";
import type { ICustomerService } from "./interfaces/icustomer.service";

@injectable()
export class CustomerController {
  constructor(@inject(TYPES.CustomerService) private readonly customerService: ICustomerService) {}

  list = async (_req: Request, res: Response) => {
    sendPaginated(res, await this.customerService.list(res.locals.query));
  };

  // 200 with data: null when nobody has this mobile, so the POS can offer "new customer".
  lookup = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.customerService.lookupByMobile(res.locals.query.mobile));
  };

  getById = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.customerService.getById(res.locals.params.id));
  };

  create = async (_req: Request, res: Response) => {
    sendCreated(res, await this.customerService.create(res.locals.auth, res.locals.body), "Customer created");
  };

  update = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.customerService.update(res.locals.auth, res.locals.params.id, res.locals.body), {
      message: "Customer updated",
    });
  };

  remove = async (_req: Request, res: Response) => {
    await this.customerService.remove(res.locals.auth, res.locals.params.id);
    sendSuccess(res, null, { message: "Customer deleted" });
  };
}
