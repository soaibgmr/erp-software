import { inject, injectable } from "inversify";
import type { Request, Response } from "express";
import { TYPES } from "../../config/ioc.types";
import { sendPaginated, sendSuccess } from "../../common/api-response";
import { BUSINESS_STATUS_LABELS } from "@erp-software/shared";
import type { IPlatformService } from "./interfaces/iplatform.service";

@injectable()
export class PlatformController {
  constructor(@inject(TYPES.PlatformService) private readonly platform: IPlatformService) {}

  login = async (req: Request, res: Response) => {
    const { email, password } = res.locals.body;
    sendSuccess(res, await this.platform.login(email, password, req.ip), { message: "Logged in" });
  };

  me = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.platform.me(res.locals.platformAdmin));
  };

  listBusinesses = async (_req: Request, res: Response) => {
    sendPaginated(res, await this.platform.listBusinesses(res.locals.query));
  };

  requestDemo = async (req: Request, res: Response) => {
    await this.platform.requestDemo(res.locals.body, req.ip);
    sendSuccess(res, null, { status: 201, message: "Thanks! We'll call you soon to book your demo." });
  };

  listDemoRequests = async (_req: Request, res: Response) => {
    sendPaginated(res, await this.platform.listDemoRequests(res.locals.query));
  };

  setDemoRequestHandled = async (_req: Request, res: Response) => {
    const found = await this.platform.setDemoRequestHandled(res.locals.params.id, res.locals.body.handled);
    sendSuccess(res, found, { message: found.handledAt ? "Marked as handled" : "Marked as open" });
  };

  updateStatus = async (_req: Request, res: Response) => {
    const shop = await this.platform.updateStatus(res.locals.platformAdmin, res.locals.params.id, res.locals.body);
    sendSuccess(res, shop, { message: `${shop.name}: ${BUSINESS_STATUS_LABELS[shop.status]}` });
  };
}
