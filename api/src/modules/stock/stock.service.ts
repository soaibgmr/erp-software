import { inject, injectable } from "inversify";
import { formatQty, fromMilli, milliToDecimal, toMilli } from "@automobile/shared";
import { TYPES } from "../../config/ioc.types";
import { canAccessBranch, type AuthContext } from "../../common/auth-context";
import { badRequest, conflict, forbidden, notFound } from "../../common/http-error";
import type { Paginated } from "../../common/pagination";
import type { Db } from "../../common/prisma-types";
import type { IAuditService } from "../audit/interfaces/iaudit.service";
import type { IBranchRepository } from "../branches/interfaces/ibranch.repository";
import type { ItemStockDto } from "../items/item.types";
import type { IStockRepository } from "./interfaces/istock.repository";
import type { IStockService } from "./interfaces/istock.service";
import { toStockDto } from "./stock.mapper";
import type {
  LedgerEntryDto,
  LedgerInsert,
  LedgerQuery,
  ListStockQuery,
  PostOptions,
  StockMovement,
  StockRowDto,
  UpdateStockSettingsDto,
} from "./stock.types";

const key = (branchId: string, itemId: string) => `${branchId}:${itemId}`;

@injectable()
export class StockService implements IStockService {
  constructor(
    @inject(TYPES.StockRepository) private readonly stock: IStockRepository,
    @inject(TYPES.BranchRepository) private readonly branches: IBranchRepository,
    @inject(TYPES.AuditService) private readonly audit: IAuditService,
  ) {}

  async post(
    db: Db,
    actor: { userId: string },
    movements: StockMovement[],
    { allowNegative }: PostOptions,
  ): Promise<void> {
    const moves = movements.filter((m) => toMilli(m.quantity) !== 0);
    if (!moves.length) return;

    const pairs = [
      ...new Map(moves.map((m) => [key(m.branchId, m.itemId), { branchId: m.branchId, itemId: m.itemId }])).values(),
    ];
    const locked = await this.stock.lockBalances(db, pairs);
    const balances = new Map(locked.map((b) => [key(b.branchId, b.itemId), { ...b }]));

    const ledger: LedgerInsert[] = [];
    const changed = new Set<string>();
    for (const m of moves) {
      const k = key(m.branchId, m.itemId);
      const b = balances.get(k);
      if (!b) throw notFound("Item not found");
      const qty = toMilli(m.quantity);
      const before = b.onHand;
      b.onHand += qty;

      if (qty < 0 && !allowNegative && b.onHand - b.reserved < 0) {
        const available = Math.max(before - b.reserved, 0);
        throw conflict(
          `Not enough stock of ${b.name} (${b.sku}): ${formatQty(fromMilli(available))} available, ${formatQty(fromMilli(-qty))} needed`,
        );
      }
      ledger.push({
        branchId: m.branchId,
        itemId: m.itemId,
        type: m.type,
        quantity: milliToDecimal(qty),
        balanceAfter: milliToDecimal(b.onHand),
        unitCost: m.unitCost == null ? null : m.unitCost.toFixed(2),
        refType: m.refType ?? null,
        refId: m.refId ?? null,
        refNo: m.refNo ?? null,
        note: m.note ?? null,
        createdById: actor.userId,
      });
      changed.add(k);
    }

    await this.stock.insertLedger(db, ledger);
    for (const k of changed) {
      const b = balances.get(k)!;
      await this.stock.setOnHand(db, b.branchId, b.itemId, b.onHand);
    }
  }

  async addInTransit(
    db: Db,
    branchId: string,
    lines: { itemId: string; quantity: number }[],
    sign: 1 | -1,
  ): Promise<void> {
    const sorted = [...lines].sort((a, b) => a.itemId.localeCompare(b.itemId));
    for (const l of sorted) await this.stock.addInTransit(db, branchId, l.itemId, sign * toMilli(l.quantity));
  }

  async applySettings(db: Db, branchId: string, itemId: string, input: UpdateStockSettingsDto): Promise<void> {
    await this.stock.upsertSettings(branchId, itemId, input, db);
  }

  async list(
    auth: AuthContext,
    currentBranchId: string | undefined,
    query: ListStockQuery,
  ): Promise<Paginated<StockRowDto>> {
    const { branchId: requested, ...rest } = query;
    let branchIds: string[];
    if (requested === "all") {
      const branches = await this.branches.list({
        includeInactive: false,
        ids: auth.isOwner ? undefined : auth.branchIds,
      });
      branchIds = branches.map((b) => b.id);
    } else {
      const id = requested ?? currentBranchId;
      if (!id) throw badRequest("Choose a branch");
      if (!canAccessBranch(auth, id)) throw forbidden("You don't have access to this branch");
      branchIds = [id];
    }
    if (!branchIds.length) return { data: [], page: query.page, limit: query.limit, total: 0 };
    return this.stock.list({ ...rest, branchIds, includeEmpty: branchIds.length === 1 });
  }

  ledger(
    auth: AuthContext,
    itemId: string,
    branchId: string,
    { page, limit }: LedgerQuery,
  ): Promise<Paginated<LedgerEntryDto>> {
    if (!canAccessBranch(auth, branchId)) throw forbidden("You don't have access to this branch");
    return this.stock.ledger(branchId, itemId, page, limit);
  }

  async updateSettings(
    auth: AuthContext,
    branchId: string,
    itemId: string,
    input: UpdateStockSettingsDto,
  ): Promise<ItemStockDto> {
    const [item] = await this.stock.findLineItems([itemId]);
    if (!item) throw notFound("Item not found");
    const before = await this.stock.findStock(branchId, itemId);
    const after = toStockDto(await this.stock.upsertSettings(branchId, itemId, input));
    await this.audit.record(auth, {
      action: "stock.settings.update",
      entity: "Item",
      entityId: itemId,
      branchId,
      before: before && {
        minLevel: toStockDto(before).minLevel,
        reorderQty: toStockDto(before).reorderQty,
        binLocation: before.binLocation,
      },
      after: { minLevel: after.minLevel, reorderQty: after.reorderQty, binLocation: after.binLocation },
    });
    return after;
  }
}
