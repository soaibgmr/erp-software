import { inject, injectable } from "inversify";
import { divRound, toMilli, toPaise } from "@erp-software/shared";
import { TYPES } from "../../config/ioc.types";
import { canAccessBranch, hasPermission, type AuthContext } from "../../common/auth-context";
import { conflict, fieldErrors, forbidden, notFound } from "../../common/http-error";
import type { Paginated } from "../../common/pagination";
import type { IUnitOfWork } from "../../common/unit-of-work";
import type { IAuditService } from "../audit/interfaces/iaudit.service";
import type { IDocumentSequenceService } from "../document-sequences/interfaces/idocument-sequence.service";
import type { ISettingsService } from "../settings/interfaces/isettings.service";
import type { IStockDocumentRepository } from "./interfaces/istock-document.repository";
import type { IStockRepository } from "./interfaces/istock.repository";
import type { IStockAdjustmentService, IStockService } from "./interfaces/istock.service";
import type {
  CreateStockAdjustmentDto,
  ListAdjustmentsQuery,
  StockAdjustmentDetailDto,
  StockAdjustmentDto,
  StockMovement,
} from "./stock.types";

const REF = "StockAdjustment";

@injectable()
export class StockAdjustmentService implements IStockAdjustmentService {
  constructor(
    @inject(TYPES.UnitOfWork) private readonly uow: IUnitOfWork,
    @inject(TYPES.StockService) private readonly stock: IStockService,
    @inject(TYPES.StockRepository) private readonly stockRepo: IStockRepository,
    @inject(TYPES.StockDocumentRepository) private readonly docs: IStockDocumentRepository,
    @inject(TYPES.DocumentSequenceService) private readonly sequences: IDocumentSequenceService,
    @inject(TYPES.SettingsService) private readonly settings: ISettingsService,
    @inject(TYPES.AuditService) private readonly audit: IAuditService,
  ) {}

  list(branchId: string, query: ListAdjustmentsQuery): Promise<Paginated<StockAdjustmentDto>> {
    return this.docs.listAdjustments(branchId, query);
  }

  async getById(auth: AuthContext, id: string): Promise<StockAdjustmentDetailDto> {
    const adj = await this.docs.findAdjustment(id);
    if (!adj || !canAccessBranch(auth, adj.branchId)) throw notFound("Stock adjustment not found");
    return adj;
  }

  async create(
    auth: AuthContext,
    branchId: string,
    input: CreateStockAdjustmentDto,
  ): Promise<StockAdjustmentDetailDto> {
    const items = await this.stockRepo.findLineItems(input.lines.map((l) => l.itemId));
    const byId = new Map(items.map((i) => [i.id, i]));
    const missing = input.lines.findIndex((l) => !byId.has(l.itemId));
    if (missing >= 0) throw fieldErrors([{ path: `lines.${missing}.itemId`, message: "Item not found" }]);

    // Value at purchase price decides whether a manager has to approve.
    const lines = input.lines.map((l) => ({ ...l, unitCost: byId.get(l.itemId)!.purchasePrice }));
    const totalPaise = lines.reduce(
      (sum, l) => sum + divRound(Math.abs(toMilli(l.quantity)) * toPaise(l.unitCost), 1000),
      0,
    );
    const [{ adjustmentApprovalLimit }, { allowNegativeStock }] = await Promise.all([
      this.settings.get("inventory"),
      this.settings.get("pos"),
    ]);
    const needsApproval = totalPaise > toPaise(adjustmentApprovalLimit) && !hasPermission(auth, "stock.approve");

    const id = await this.uow.run(async (tx) => {
      const { number } = await this.sequences.next(tx, branchId, "STOCK_ADJUSTMENT");
      const created = await this.docs.createAdjustment(tx, {
        number,
        branchId,
        reason: input.reason,
        note: input.note ?? null,
        status: needsApproval ? "PENDING" : "POSTED",
        totalValue: (totalPaise / 100).toFixed(2),
        createdById: auth.userId,
        lines: lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity.toFixed(3), unitCost: l.unitCost })),
      });
      if (!needsApproval) {
        await this.stock.post(
          tx,
          auth,
          this.movements(branchId, created.id, number, input.reason, input.note ?? null, lines),
          { allowNegative: allowNegativeStock },
        );
      }
      await this.audit.record(
        auth,
        {
          action: needsApproval ? "stock.adjustment.request" : "stock.adjustment.post",
          entity: REF,
          entityId: created.id,
          branchId,
          after: { number, reason: input.reason, totalValue: (totalPaise / 100).toFixed(2), lines: input.lines },
        },
        tx,
      );
      return created.id;
    });
    return this.getById(auth, id);
  }

  async approve(auth: AuthContext, branchId: string, id: string): Promise<StockAdjustmentDetailDto> {
    const adj = await this.pending(auth, branchId, id);
    const { allowNegativeStock } = await this.settings.get("pos");
    await this.uow.run(async (tx) => {
      if (!(await this.docs.decideAdjustment(tx, id, "POSTED", auth.userId, null)))
        throw conflict("This adjustment was already decided");
      const lines = adj.lines.map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity), unitCost: l.unitCost }));
      await this.stock.post(tx, auth, this.movements(adj.branchId, adj.id, adj.number, adj.reason, adj.note, lines), {
        allowNegative: allowNegativeStock,
      });
      await this.audit.record(
        auth,
        {
          action: "stock.adjustment.approve",
          entity: REF,
          entityId: id,
          branchId,
          after: { number: adj.number, totalValue: adj.totalValue },
        },
        tx,
      );
    });
    return this.getById(auth, id);
  }

  async reject(
    auth: AuthContext,
    branchId: string,
    id: string,
    note: string | null,
  ): Promise<StockAdjustmentDetailDto> {
    const adj = await this.pending(auth, branchId, id);
    await this.uow.run(async (tx) => {
      if (!(await this.docs.decideAdjustment(tx, id, "REJECTED", auth.userId, note)))
        throw conflict("This adjustment was already decided");
      await this.audit.record(
        auth,
        { action: "stock.adjustment.reject", entity: REF, entityId: id, branchId, after: { number: adj.number, note } },
        tx,
      );
    });
    return this.getById(auth, id);
  }

  private async pending(auth: AuthContext, branchId: string, id: string) {
    const adj = await this.getById(auth, id);
    if (adj.branchId !== branchId) throw forbidden("Switch to the adjustment's branch to decide it");
    if (adj.status !== "PENDING") throw conflict("This adjustment was already decided");
    return adj;
  }

  private movements(
    branchId: string,
    refId: string,
    refNo: string,
    reason: CreateStockAdjustmentDto["reason"],
    note: string | null,
    lines: { itemId: string; quantity: number; unitCost: string }[],
  ): StockMovement[] {
    return lines.map((l) => ({
      branchId,
      itemId: l.itemId,
      type: reason === "OPENING_STOCK" ? "OPENING" : "ADJUSTMENT",
      quantity: l.quantity,
      unitCost: Number(l.unitCost),
      refType: REF,
      refId,
      refNo,
      note,
    }));
  }
}
