import { inject, injectable } from "inversify";
import type { Request, Response } from "express";
import { TYPES } from "../../config/ioc.types";
import { sendCreated, sendPaginated, sendSuccess } from "../../common/api-response";
import type { IItemService } from "./interfaces/iitem.service";

// `res.locals.branchId` comes from the optional x-branch-id header and fills each item's `stock`.
@injectable()
export class ItemController {
  constructor(@inject(TYPES.ItemService) private readonly items: IItemService) {}

  list = async (_req: Request, res: Response) => {
    sendPaginated(res, await this.items.list(res.locals.query, res.locals.branchId));
  };

  search = async (_req: Request, res: Response) => {
    const { q, limit } = res.locals.query;
    sendSuccess(res, await this.items.search(q, limit, res.locals.branchId));
  };

  byCode = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.items.getByCode(res.locals.params.code, res.locals.branchId));
  };

  getById = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.items.getById(res.locals.auth, res.locals.params.id, res.locals.branchId));
  };

  create = async (_req: Request, res: Response) => {
    const item = await this.items.create(res.locals.auth, res.locals.body, res.locals.branchId);
    sendCreated(res, item, "Item created");
  };

  update = async (_req: Request, res: Response) => {
    const item = await this.items.update(res.locals.auth, res.locals.params.id, res.locals.body, res.locals.branchId);
    sendSuccess(res, item, { message: "Item updated" });
  };

  remove = async (_req: Request, res: Response) => {
    await this.items.remove(res.locals.auth, res.locals.params.id);
    sendSuccess(res, null, { message: "Item deleted" });
  };
}
