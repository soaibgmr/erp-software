import { inject, injectable } from "inversify";
import type { Request, Response } from "express";
import { TYPES } from "../../config/ioc.types";
import { sendCreated, sendSuccess } from "../../common/api-response";
import type { IPosScannerService } from "./interfaces/ipos-scanner.service";
import { SCAN_TOKEN_HEADER } from "./pos-scanner.schema";

@injectable()
export class PosScannerController {
  constructor(@inject(TYPES.PosScannerService) private readonly scanner: IPosScannerService) {}

  // Counter PC
  create = async (_req: Request, res: Response) => {
    sendCreated(res, await this.scanner.create(res.locals.auth, res.locals.branchId), "Phone scanner ready");
  };

  poll = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.scanner.poll(res.locals.auth, res.locals.params.id, res.locals.query.after));
  };

  end = async (_req: Request, res: Response) => {
    await this.scanner.end(res.locals.auth, res.locals.params.id);
    sendSuccess(res, null, { message: "Phone scanner ended" });
  };

  // Phone
  ping = async (req: Request, res: Response) => {
    sendSuccess(res, await this.scanner.ping(res.locals.params.id, req.get(SCAN_TOKEN_HEADER)));
  };

  scan = async (req: Request, res: Response) => {
    sendSuccess(res, await this.scanner.scan(res.locals.params.id, req.get(SCAN_TOKEN_HEADER), res.locals.body.code));
  };
}
