import { inject, injectable } from "inversify";
import { PrismaClient } from "@prisma/client";
import { TYPES } from "../../config/ioc.types";
import type { GstTotalsRow, IDashboardRepository } from "./interfaces/idashboard.repository";

const ZERO_GST: GstTotalsRow = {
  taxable: "0",
  cgst: "0",
  sgst: "0",
  igst: "0",
  returnTaxable: "0",
  returnCgst: "0",
  returnSgst: "0",
  returnIgst: "0",
};

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

  // GST on sale invoices dated in [start, end) and on credit notes raised in [start, end) (the GSTR-3B rule).
  async gstTotals(branchIds: string[], start: Date, end: Date) {
    const [row] = await this.prisma.$queryRaw<GstTotalsRow[]>`
      WITH sales AS (
        SELECT COALESCE(SUM(taxable_total), 0) AS taxable, COALESCE(SUM(cgst_total), 0) AS cgst,
               COALESCE(SUM(sgst_total), 0) AS sgst, COALESCE(SUM(igst_total), 0) AS igst
          FROM invoices
         WHERE branch_id = ANY(${branchIds}::uuid[]) AND invoice_date >= ${start} AND invoice_date < ${end}
           AND status <> 'CANCELLED' AND kind = 'SALE'
      ), returns AS (
        SELECT COALESCE(SUM(taxable_total), 0) AS taxable, COALESCE(SUM(cgst_total), 0) AS cgst,
               COALESCE(SUM(sgst_total), 0) AS sgst, COALESCE(SUM(igst_total), 0) AS igst
          FROM credit_notes
         WHERE branch_id = ANY(${branchIds}::uuid[]) AND created_at >= ${start} AND created_at < ${end}
      )
      SELECT s.taxable::text AS taxable, s.cgst::text AS cgst, s.sgst::text AS sgst, s.igst::text AS igst,
             r.taxable::text AS "returnTaxable", r.cgst::text AS "returnCgst",
             r.sgst::text AS "returnSgst", r.igst::text AS "returnIgst"
        FROM sales s CROSS JOIN returns r`;
    return row ?? ZERO_GST;
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
