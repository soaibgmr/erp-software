import { inject, injectable } from "inversify";
import type { Request, Response } from "express";
import { TYPES } from "../../config/ioc.types";
import { sendPaginated } from "../../common/api-response";
import type { IAuditService } from "./interfaces/iaudit.service";

@injectable()
export class AuditController {
  constructor(@inject(TYPES.AuditService) private readonly auditService: IAuditService) {}

  list = async (_req: Request, res: Response) => {
    sendPaginated(res, await this.auditService.list(res.locals.auth.businessId, res.locals.query));
  };
}
