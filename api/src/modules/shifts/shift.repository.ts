import { inject, injectable } from "inversify";
import { Prisma, PrismaClient } from "@prisma/client";
import { toPaise } from "@automobile/shared";
import { TYPES } from "../../config/ioc.types";
import type { Paginated } from "../../common/pagination";
import { loadUserNames } from "../../common/user-names";
import type { IShiftRepository } from "./interfaces/ishift.repository";
import type { ListShiftsQuery, ShiftRow } from "./shift.types";

const select = {
  id: true,
  branchId: true,
  userId: true,
  counter: true,
  status: true,
  openingCash: true,
  openedAt: true,
  closedAt: true,
  closeNote: true,
  counted: true,
} satisfies Prisma.ShiftSelect;

type Row = Prisma.ShiftGetPayload<{ select: typeof select }>;

const toRow = (r: Row, users: Awaited<ReturnType<typeof loadUserNames>>): ShiftRow => ({
  ...r,
  user: users.get(r.userId) ?? null,
  openingCash: r.openingCash.toFixed(2),
  counted: (r.counted as Record<string, string> | null) ?? null,
});

@injectable()
export class ShiftRepository implements IShiftRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  async findOpen(branchId: string, userId: string) {
    const r = await this.prisma.shift.findFirst({
      where: { branchId, userId, status: "OPEN" },
      select,
      orderBy: { openedAt: "desc" },
    });
    return r && (await this.withUsers([r]))[0]!;
  }

  async findById(id: string) {
    const r = await this.prisma.shift.findUnique({ where: { id }, select });
    return r && (await this.withUsers([r]))[0]!;
  }

  async create(data: { branchId: string; userId: string; counter: string; openingCash: string }) {
    return (await this.withUsers([await this.prisma.shift.create({ data, select })]))[0]!;
  }

  private async withUsers(rows: Row[]): Promise<ShiftRow[]> {
    const users = await loadUserNames(
      this.prisma,
      rows.map((r) => r.userId),
    );
    return rows.map((r) => toRow(r, users));
  }

  async close(
    id: string,
    data: { counted: Record<string, string>; expected: Record<string, string>; note: string | null },
  ) {
    const { count } = await this.prisma.shift.updateMany({
      where: { id, status: "OPEN" },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        counted: data.counted,
        expected: data.expected,
        closeNote: data.note,
      },
    });
    return count > 0;
  }

  async paymentTotals(shiftId: string) {
    const rows = await this.prisma.payment.groupBy({ by: ["mode"], where: { shiftId }, _sum: { amount: true } });
    return rows.map((r) => ({ mode: r.mode, amountPaise: toPaise((r._sum.amount ?? 0).toString()) }));
  }

  async invoiceStats(shiftId: string) {
    const [row] = await this.prisma.$queryRaw<{ count: bigint; total: string; cancelled: bigint; credit: string }[]>`
      SELECT COUNT(*) FILTER (WHERE status <> 'CANCELLED') AS count,
             COALESCE(SUM(grand_total) FILTER (WHERE status <> 'CANCELLED'), 0)::text AS total,
             COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled,
             COALESCE(SUM(GREATEST(grand_total - credited_total - paid_total, 0)) FILTER (WHERE status <> 'CANCELLED'), 0)::text AS credit
        FROM invoices WHERE shift_id = ${shiftId}::uuid`;
    return {
      count: Number(row?.count ?? 0),
      totalPaise: toPaise(row?.total ?? "0"),
      cancelledCount: Number(row?.cancelled ?? 0),
      creditPaise: toPaise(row?.credit ?? "0"),
    };
  }

  async list(branchId: string, { page, limit, status }: ListShiftsQuery): Promise<Paginated<ShiftRow>> {
    const where: Prisma.ShiftWhereInput = { branchId, status };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.shift.findMany({
        where,
        select,
        orderBy: { openedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.shift.count({ where }),
    ]);
    return { data: await this.withUsers(rows), page, limit, total };
  }
}
