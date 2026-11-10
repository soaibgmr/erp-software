import { inject, injectable } from "inversify";
import type { Request, Response } from "express";
import { TYPES } from "../../config/ioc.types";
import { sendCreated, sendSuccess } from "../../common/api-response";
import type { IBranchService } from "./interfaces/ibranch.service";

@injectable()
export class BranchController {
  constructor(@inject(TYPES.BranchService) private readonly branchService: IBranchService) {}

  list = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.branchService.list(res.locals.auth, res.locals.query));
  };

  getById = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.branchService.getById(res.locals.auth, res.locals.params.id));
  };

  create = async (_req: Request, res: Response) => {
    sendCreated(res, await this.branchService.create(res.locals.auth, res.locals.body), "Branch created");
  };

  update = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.branchService.update(res.locals.auth, res.locals.params.id, res.locals.body), {
      message: "Branch updated",
    });
  };

  remove = async (_req: Request, res: Response) => {
    await this.branchService.remove(res.locals.auth, res.locals.params.id);
    sendSuccess(res, null, { message: "Branch deleted" });
  };
}
