import { inject, injectable } from "inversify";
import { Prisma, PrismaClient } from "@prisma/client";
import { milliToDecimal, toMilli } from "@automobile/shared";
import { TYPES } from "../../config/ioc.types";
import type { Paginated } from "../../common/pagination";
import type { Db } from "../../common/prisma-types";
import { loadUserNames } from "../../common/user-names";
import type { IStockDocumentRepository } from "./interfaces/istock-document.repository";
import type {
  CreateAdjustmentData,
  CreateTransferData,
  ListAdjustmentsQuery,
  ListTransfersQuery,
  StockAdjustmentDetailDto,
  StockAdjustmentDto,
  StockTransferDetailDto,
  StockTransferDto,
} from "./stock.types";

const lineItemSelect = { id: true, sku: true, name: true, unit: true } as const;
const branchRef = { select: { id: true, code: true, name: true } } as const;

const adjustmentSelect = {
  id: true,
  number: true,
  branchId: true,
  reason: true,
  note: true,
  status: true,
  totalValue: true,
  createdById: true,
  decidedById: true,
  decidedAt: true,
  decisionNote: true,
  createdAt: true,
  _count: { select: { lines: true } },
} satisfies Prisma.StockAdjustmentSelect;

const transferSelect = {
  id: true,
  number: true,
  status: true,
  note: true,
  createdById: true,
  closedById: true,
  closedAt: true,
  createdAt: true,
  fromBranch: branchRef,
  toBranch: branchRef,
  lines: { select: { itemId: true, quantity: true, unitCost: true } },
} satisfies Prisma.StockTransferSelect;

type AdjustmentRow = Prisma.StockAdjustmentGetPayload<{ select: typeof adjustmentSelect }>;
type TransferRow = Prisma.StockTransferGetPayload<{ select: typeof transferSelect }>;
type Users = Awaited<ReturnType<typeof loadUserNames>>;

const ref = (users: Users, id: string | null) => (id && users.get(id)) || null;

const adjustmentDto = (r: AdjustmentRow, users: Users): StockAdjustmentDto => ({
  id: r.id,
  number: r.number,
  branchId: r.branchId,
  reason: r.reason,
  note: r.note,
  status: r.status,
  totalValue: r.totalValue.toFixed(2),
  lineCount: r._count.lines,
  createdBy: ref(users, r.createdById),
  decidedBy: ref(users, r.decidedById),
  decidedAt: r.decidedAt,
  decisionNote: r.decisionNote,
  createdAt: r.createdAt,
});

const transferDto = (r: TransferRow, users: Users): StockTransferDto => ({
  id: r.id,
  number: r.number,
  status: r.status,
  fromBranch: r.fromBranch,
  toBranch: r.toBranch,
  note: r.note,
  lineCount: r.lines.length,
  totalQuantity: milliToDecimal(r.lines.reduce((sum, l) => sum + toMilli(l.quantity.toString()), 0)),
  createdBy: ref(users, r.createdById),
  closedBy: ref(users, r.closedById),
  closedAt: r.closedAt,
  createdAt: r.createdAt,
});

@injectable()
export class StockDocumentRepository implements IStockDocumentRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  // ---------- Adjustments ----------

  createAdjustment(db: Db, { lines, ...data }: CreateAdjustmentData) {
    return db.stockAdjustment.create({ data: { ...data, lines: { create: lines } }, select: { id: true } });
  }

  async findAdjustment(id: string, db: Db = this.prisma): Promise<StockAdjustmentDetailDto | null> {
    const row = await db.stockAdjustment.findUnique({
      where: { id },
      select: { ...adjustmentSelect, lines: { select: { itemId: true, quantity: true, unitCost: true } } },
    });
    if (!row) return null;
    const [users, items] = await Promise.all([
      loadUserNames(this.prisma, [row.createdById, row.decidedById]),
      this.lineItems(row.lines.map((l) => l.itemId)),
    ]);
    return {
      ...adjustmentDto(row, users),
      lines: row.lines.map((l) => {
        const item = items.get(l.itemId);
        return {
          itemId: l.itemId,
          sku: item?.sku ?? "",
          name: item?.name ?? "Deleted item",
          unit: item?.unit ?? "PCS",
          quantity: l.quantity.toFixed(3),
          unitCost: l.unitCost.toFixed(2),
          value: l.quantity.abs().mul(l.unitCost).toFixed(2),
        };
      }),
    };
  }

  async listAdjustments(
    branchId: string,
    { page, limit, status }: ListAdjustmentsQuery,
  ): Promise<Paginated<StockAdjustmentDto>> {
    const where: Prisma.StockAdjustmentWhereInput = { branchId, status };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stockAdjustment.findMany({
        where,
        select: adjustmentSelect,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockAdjustment.count({ where }),
    ]);
    const users = await loadUserNames(
      this.prisma,
      rows.flatMap((r) => [r.createdById, r.decidedById]),
    );
    return { data: rows.map((r) => adjustmentDto(r, users)), page, limit, total };
  }

  async decideAdjustment(db: Db, id: string, to: "POSTED" | "REJECTED", decidedById: string, note: string | null) {
    const { count } = await db.stockAdjustment.updateMany({
      where: { id, status: "PENDING" },
      data: { status: to, decidedById, decidedAt: new Date(), decisionNote: note },
    });
    return count > 0;
  }

  // ---------- Transfers ----------

  createTransfer(db: Db, { lines, ...data }: CreateTransferData) {
    return db.stockTransfer.create({ data: { ...data, lines: { create: lines } }, select: { id: true } });
  }

  async findTransfer(id: string, db: Db = this.prisma): Promise<StockTransferDetailDto | null> {
    const row = await db.stockTransfer.findUnique({ where: { id }, select: transferSelect });
    if (!row) return null;
    const [users, items] = await Promise.all([
      loadUserNames(this.prisma, [row.createdById, row.closedById]),
      this.lineItems(row.lines.map((l) => l.itemId)),
    ]);
    return {
      ...transferDto(row, users),
      lines: row.lines.map((l) => {
        const item = items.get(l.itemId);
        return {
          itemId: l.itemId,
          sku: item?.sku ?? "",
          name: item?.name ?? "Deleted item",
          unit: item?.unit ?? "PCS",
          quantity: l.quantity.toFixed(3),
          unitCost: l.unitCost.toFixed(2),
        };
      }),
    };
  }

  async listTransfers(
    branchId: string,
    { page, limit, direction, status }: ListTransfersQuery,
  ): Promise<Paginated<StockTransferDto>> {
    const where: Prisma.StockTransferWhereInput = {
      status,
      ...(direction === "in"
        ? { toBranchId: branchId }
        : direction === "out"
          ? { fromBranchId: branchId }
          : { OR: [{ toBranchId: branchId }, { fromBranchId: branchId }] }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stockTransfer.findMany({
        where,
        select: transferSelect,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockTransfer.count({ where }),
    ]);
    const users = await loadUserNames(
      this.prisma,
      rows.flatMap((r) => [r.createdById, r.closedById]),
    );
    return { data: rows.map((r) => transferDto(r, users)), page, limit, total };
  }

  async closeTransfer(db: Db, id: string, to: "RECEIVED" | "CANCELLED", closedById: string) {
    const { count } = await db.stockTransfer.updateMany({
      where: { id, status: "IN_TRANSIT" },
      data: { status: to, closedById, closedAt: new Date() },
    });
    return count > 0;
  }

  private async lineItems(ids: string[]) {
    const rows = await this.prisma.item.findMany({ where: { id: { in: [...new Set(ids)] } }, select: lineItemSelect });
    return new Map(rows.map((r) => [r.id, r]));
  }
}
