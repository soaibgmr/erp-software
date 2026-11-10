import { inject, injectable } from "inversify";
import type { Request, Response } from "express";
import { TYPES } from "../../config/ioc.types";
import { sendCreated, sendPaginated, sendSuccess } from "../../common/api-response";
import { badRequest } from "../../common/http-error";
import type {
  IStockAdjustmentService,
  IStockImportService,
  IStockService,
  IStockTransferService,
} from "./interfaces/istock.service";

// res.locals.branchId is the x-branch-id header, resolved and access-checked by AuthMiddleware.
@injectable()
export class StockController {
  constructor(
    @inject(TYPES.StockService) private readonly stock: IStockService,
    @inject(TYPES.StockAdjustmentService) private readonly adjustments: IStockAdjustmentService,
    @inject(TYPES.StockTransferService) private readonly transfers: IStockTransferService,
    @inject(TYPES.StockImportService) private readonly importer: IStockImportService,
  ) {}

  // ---------- Levels and ledger ----------

  list = async (_req: Request, res: Response) => {
    sendPaginated(res, await this.stock.list(res.locals.auth, res.locals.branchId, res.locals.query));
  };

  ledger = async (_req: Request, res: Response) => {
    const branchId = res.locals.query.branchId ?? res.locals.branchId;
    if (!branchId) throw badRequest("Choose a branch");
    sendPaginated(res, await this.stock.ledger(res.locals.auth, res.locals.params.itemId, branchId, res.locals.query));
  };

  updateSettings = async (_req: Request, res: Response) => {
    const stock = await this.stock.updateSettings(
      res.locals.auth,
      res.locals.branchId,
      res.locals.params.itemId,
      res.locals.body,
    );
    sendSuccess(res, stock, { message: "Stock settings saved" });
  };

  // ---------- Adjustments ----------

  listAdjustments = async (_req: Request, res: Response) => {
    sendPaginated(res, await this.adjustments.list(res.locals.branchId, res.locals.query));
  };

  getAdjustment = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.adjustments.getById(res.locals.auth, res.locals.params.id));
  };

  createAdjustment = async (_req: Request, res: Response) => {
    const adj = await this.adjustments.create(res.locals.auth, res.locals.branchId, res.locals.body);
    sendCreated(res, adj, adj.status === "PENDING" ? `${adj.number} sent for approval` : `${adj.number} posted`);
  };

  approveAdjustment = async (_req: Request, res: Response) => {
    const adj = await this.adjustments.approve(res.locals.auth, res.locals.branchId, res.locals.params.id);
    sendSuccess(res, adj, { message: `${adj.number} approved and posted` });
  };

  rejectAdjustment = async (_req: Request, res: Response) => {
    const adj = await this.adjustments.reject(
      res.locals.auth,
      res.locals.branchId,
      res.locals.params.id,
      res.locals.body.note ?? null,
    );
    sendSuccess(res, adj, { message: `${adj.number} rejected` });
  };

  // ---------- Transfers ----------

  listTransfers = async (_req: Request, res: Response) => {
    sendPaginated(res, await this.transfers.list(res.locals.branchId, res.locals.query));
  };

  getTransfer = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.transfers.getById(res.locals.auth, res.locals.params.id));
  };

  createTransfer = async (_req: Request, res: Response) => {
    const t = await this.transfers.create(res.locals.auth, res.locals.branchId, res.locals.body);
    sendCreated(res, t, `${t.number} dispatched to ${t.toBranch.name}`);
  };

  receiveTransfer = async (_req: Request, res: Response) => {
    const t = await this.transfers.receive(res.locals.auth, res.locals.branchId, res.locals.params.id);
    sendSuccess(res, t, { message: `${t.number} received` });
  };

  cancelTransfer = async (_req: Request, res: Response) => {
    const t = await this.transfers.cancel(res.locals.auth, res.locals.branchId, res.locals.params.id);
    sendSuccess(res, t, { message: `${t.number} cancelled` });
  };

  // ---------- Import ----------

  import = async (_req: Request, res: Response) => {
    const report = await this.importer.run(res.locals.auth, res.locals.branchId, res.locals.body);
    sendSuccess(res, report, { message: report.committed ? "Import complete" : "Preview ready" });
  };
}
