import { inject, injectable } from "inversify";
import { PrismaClient } from "@prisma/client";
import { TYPES } from "../../config/ioc.types";
import type { IDashboardRepository } from "./interfaces/idashboard.repository";

// Uses the (branch_id, invoice_date) index on invoices and (branch_id, received_at) on payments.
@injectable()
export class DashboardRepository implements IDashboardRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  async salesTotals(branchIds: string[], start: Date, end: Date) {
    const [row] = await this.prisma.$queryRaw<{ total: string; bills: bigint }[]>`
      SELECT COALESCE(SUM(grand_total), 0)::text AS total, COUNT(*) AS bills
        FROM invoices
       WHERE branch_id = ANY(${branchIds}::uuid[]) AND invoice_date >= ${start} AND invoice_date < ${end}
         AND status <> 'CANCELLED' AND kind = 'SALE'`;
    return { total: row?.total ?? "0", bills: Number(row?.bills ?? 0) };
  }

  collections(branchIds: string[], start: Date, end: Date) {
    return this.prisma.$queryRaw<{ mode: string; amount: string }[]>`
      SELECT mode, SUM(amount)::text AS amount
        FROM payments
       WHERE branch_id = ANY(${branchIds}::uuid[]) AND received_at >= ${start} AND received_at < ${end}
       GROUP BY mode
       ORDER BY SUM(amount) DESC`;
  }

  async salesTrend(branchIds: string[], start: Date, end: Date, timeZone: string) {
    const rows = await this.prisma.$queryRaw<{ day: string; bills: bigint; parts: string; labour: string }[]>`
      SELECT to_char((i.invoice_date AT TIME ZONE ${timeZone})::date, 'YYYY-MM-DD') AS day,
             COUNT(DISTINCT i.id) AS bills,
             COALESCE(SUM(l.total) FILTER (WHERE l.kind = 'ITEM'), 0)::text AS parts,
             COALESCE(SUM(l.total) FILTER (WHERE l.kind = 'LABOUR'), 0)::text AS labour
        FROM invoices i JOIN invoice_lines l ON l.invoice_id = i.id
       WHERE i.branch_id = ANY(${branchIds}::uuid[]) AND i.invoice_date >= ${start} AND i.invoice_date < ${end}
         AND i.status <> 'CANCELLED'
       GROUP BY 1`;
    return rows.map((r) => ({ ...r, bills: Number(r.bills) }));
  }
}
