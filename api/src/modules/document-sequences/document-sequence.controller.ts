import { inject, injectable } from "inversify";
import type { Request, Response } from "express";
import { TYPES } from "../../config/ioc.types";
import { sendSuccess } from "../../common/api-response";
import type { IDocumentSequenceService } from "./interfaces/idocument-sequence.service";

@injectable()
export class DocumentSequenceController {
  constructor(@inject(TYPES.DocumentSequenceService) private readonly service: IDocumentSequenceService) {}

  list = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.service.list(res.locals.auth, res.locals.query.branchId));
  };

  update = async (_req: Request, res: Response) => {
    const { branchId, docType } = res.locals.params;
    sendSuccess(res, await this.service.update(res.locals.auth, branchId, docType, res.locals.body), {
      message: "Number series updated",
    });
  };
}
