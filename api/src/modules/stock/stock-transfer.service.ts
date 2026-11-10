import { inject, injectable } from "inversify";
import { TYPES } from "../../config/ioc.types";
import { canAccessBranch, type AuthContext } from "../../common/auth-context";
import { conflict, fieldErrors, forbidden, notFound } from "../../common/http-error";
import type { Paginated } from "../../common/pagination";
import type { IUnitOfWork } from "../../common/unit-of-work";
import type { IAuditService } from "../audit/interfaces/iaudit.service";
import type { IBranchRepository } from "../branches/interfaces/ibranch.repository";
import type { IDocumentSequenceService } from "../document-sequences/interfaces/idocument-sequence.service";
import type { IStockDocumentRepository } from "./interfaces/istock-document.repository";
import type { IStockRepository } from "./interfaces/istock.repository";
import type { IStockService, IStockTransferService } from "./interfaces/istock.service";
import type {
  CreateStockTransferDto,
  ListTransfersQuery,
  StockTransferDetailDto,
  StockTransferDto,
} from "./stock.types";

const REF = "StockTransfer";

// Dispatch → receive. Stock leaves the sender on dispatch (TRANSFER_OUT) and shows as in transit
// at the receiver until it is received (TRANSFER_IN) or the sender cancels (TRANSFER_CANCEL).
@injectable()
export class StockTransferService implements IStockTransferService {
  constructor(
    @inject(TYPES.UnitOfWork) private readonly uow: IUnitOfWork,
    @inject(TYPES.StockService) private readonly stock: IStockService,
    @inject(TYPES.StockRepository) private readonly stockRepo: IStockRepository,
    @inject(TYPES.StockDocumentRepository) private readonly docs: IStockDocumentRepository,
    @inject(TYPES.BranchRepository) private readonly branches: IBranchRepository,
    @inject(TYPES.DocumentSequenceService) private readonly sequences: IDocumentSequenceService,
    @inject(TYPES.AuditService) private readonly audit: IAuditService,
  ) {}

  list(branchId: string, query: ListTransfersQuery): Promise<Paginated<StockTransferDto>> {
    return this.docs.listTransfers(branchId, query);
  }

  async getById(auth: AuthContext, id: string): Promise<StockTransferDetailDto> {
    const t = await this.docs.findTransfer(id);
    if (!t || !(canAccessBranch(auth, t.fromBranch.id) || canAccessBranch(auth, t.toBranch.id))) {
      throw notFound("Stock transfer not found");
    }
    return t;
  }

  async create(
    auth: AuthContext,
    fromBranchId: string,
    input: CreateStockTransferDto,
  ): Promise<StockTransferDetailDto> {
    if (input.toBranchId === fromBranchId)
      throw fieldErrors([{ path: "toBranchId", message: "Choose a different branch" }]);
    const to = await this.branches.findById(auth.businessId, input.toBranchId);
    if (!to || !to.isActive) throw fieldErrors([{ path: "toBranchId", message: "Choose an active branch" }]);

    const items = await this.stockRepo.findLineItems(
      auth.businessId,
      input.lines.map((l) => l.itemId),
    );
    const byId = new Map(items.map((i) => [i.id, i]));
    const missing = input.lines.findIndex((l) => !byId.has(l.itemId));
    if (missing >= 0) throw fieldErrors([{ path: `lines.${missing}.itemId`, message: "Item not found" }]);

    const id = await this.uow.run(async (tx) => {
      const { number } = await this.sequences.next(tx, fromBranchId, "STOCK_TRANSFER");
      const created = await this.docs.createTransfer(tx, {
        number,
        fromBranchId,
        toBranchId: input.toBranchId,
        note: input.note ?? null,
        createdById: auth.userId,
        lines: input.lines.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity.toFixed(3),
          unitCost: byId.get(l.itemId)!.purchasePrice,
        })),
      });
      // Transfers never push the sender negative, whatever the POS setting says.
      await this.stock.post(
        tx,
        auth,
        input.lines.map((l) => ({
          branchId: fromBranchId,
          itemId: l.itemId,
          type: "TRANSFER_OUT" as const,
          quantity: -l.quantity,
          unitCost: Number(byId.get(l.itemId)!.purchasePrice),
          refType: REF,
          refId: created.id,
          refNo: number,
          note: `To ${to.name}`,
        })),
        { allowNegative: false },
      );
      await this.stock.addInTransit(tx, input.toBranchId, input.lines, 1);
      await this.audit.record(
        auth,
        {
          action: "stock.transfer.dispatch",
          entity: REF,
          entityId: created.id,
          branchId: fromBranchId,
          after: { number, toBranchId: input.toBranchId, lines: input.lines },
        },
        tx,
      );
      return created.id;
    });
    return this.getById(auth, id);
  }

  async receive(auth: AuthContext, branchId: string, id: string): Promise<StockTransferDetailDto> {
    const t = await this.open(auth, id);
    if (t.toBranch.id !== branchId) throw forbidden(`Only ${t.toBranch.name} can receive this transfer`);
    await this.close(auth, t, "RECEIVED", t.toBranch.id, "TRANSFER_IN", `From ${t.fromBranch.name}`);
    return this.getById(auth, id);
  }

  async cancel(auth: AuthContext, branchId: string, id: string): Promise<StockTransferDetailDto> {
    const t = await this.open(auth, id);
    if (t.fromBranch.id !== branchId) throw forbidden(`Only ${t.fromBranch.name} can cancel this transfer`);
    await this.close(
      auth,
      t,
      "CANCELLED",
      t.fromBranch.id,
      "TRANSFER_CANCEL",
      `Cancelled transfer to ${t.toBranch.name}`,
    );
    return this.getById(auth, id);
  }

  private async open(auth: AuthContext, id: string) {
    const t = await this.getById(auth, id);
    if (t.status !== "IN_TRANSIT")
      throw conflict(`Transfer ${t.number} is already ${t.status === "RECEIVED" ? "received" : "cancelled"}`);
    return t;
  }

  private async close(
    auth: AuthContext,
    t: StockTransferDetailDto,
    status: "RECEIVED" | "CANCELLED",
    stockBranchId: string,
    type: "TRANSFER_IN" | "TRANSFER_CANCEL",
    note: string,
  ) {
    const lines = t.lines.map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity) }));
    await this.uow.run(async (tx) => {
      if (!(await this.docs.closeTransfer(tx, t.id, status, auth.userId)))
        throw conflict(`Transfer ${t.number} was already closed`);
      await this.stock.post(
        tx,
        auth,
        t.lines.map((l) => ({
          branchId: stockBranchId,
          itemId: l.itemId,
          type,
          quantity: Number(l.quantity),
          unitCost: Number(l.unitCost),
          refType: REF,
          refId: t.id,
          refNo: t.number,
          note,
        })),
        { allowNegative: true },
      );
      await this.stock.addInTransit(tx, t.toBranch.id, lines, -1);
      await this.audit.record(
        auth,
        {
          action: `stock.transfer.${status === "RECEIVED" ? "receive" : "cancel"}`,
          entity: REF,
          entityId: t.id,
          branchId: stockBranchId,
          after: { number: t.number },
        },
        tx,
      );
    });
  }
}
