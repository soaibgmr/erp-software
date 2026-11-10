import { inject, injectable } from "inversify";
import type { Request, Response } from "express";
import { TYPES } from "../../config/ioc.types";
import { sendCreated, sendSuccess } from "../../common/api-response";
import type { IPosService } from "./interfaces/ipos.service";

@injectable()
export class PosController {
  constructor(@inject(TYPES.PosService) private readonly pos: IPosService) {}

  quote = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.pos.quote(res.locals.auth, res.locals.branchId, res.locals.body));
  };

  listHeld = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.pos.listHeld(res.locals.branchId));
  };

  getHeld = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.pos.getHeld(res.locals.auth, res.locals.params.id));
  };

  hold = async (_req: Request, res: Response) => {
    sendCreated(res, await this.pos.hold(res.locals.auth, res.locals.branchId, res.locals.body), "Cart held");
  };

  removeHeld = async (_req: Request, res: Response) => {
    await this.pos.removeHeld(res.locals.auth, res.locals.params.id);
    sendSuccess(res, null, { message: "Held cart removed" });
  };
}
