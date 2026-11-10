import { inject, injectable } from "inversify";
import { Prisma, PrismaClient } from "@prisma/client";
import { TYPES } from "../../config/ioc.types";
import { loadUserNames, type UserRef } from "../../common/user-names";
import type { IReportRepository } from "./interfaces/ireport.repository";
import type {
  CustomerPaymentRow,
  DayBookRow,
  GstCreditNoteRateRow,
  GstInvoiceRateRow,
  HsnRow,
  OpenDocumentRow,
  PaymentsByModeRow,
  Period,
  SalesByCategoryRow,
  SalesByCustomerRow,
  SalesByDayRow,
  SalesByItemRow,
  SalesInvoiceRow,
  ShiftReportRow,
  StockMovementRow,
  StockValuationRow,
} from "./report.types";

// Read-only aggregation queries. Sales are filtered on (branch_id, invoice_date), which the
// invoices index covers; payments on (branch_id, received_at). Cancelled invoices never count towards totals.

const inBranches = (column: Prisma.Sql, branchIds: string[]) => Prisma.sql`${column} = ANY(${branchIds}::uuid[])`;
const inPeriod = (column: Prisma.Sql, p: Period) => Prisma.sql`${column} >= ${p.start} AND ${column} < ${p.end}`;

const LIVE = Prisma.sql`i.status <> 'CANCELLED'`;
// Sales only: a customer's old dues (kind OPENING_BALANCE) are owed money, not a sale.
const SALES = Prisma.sql`i.kind = 'SALE'`;

@injectable()
export class ReportRepository implements IReportRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  userNames(ids: string[]): Promise<Map<string, UserRef>> {
    return loadUserNames(this.prisma, ids);
  }

  salesInvoices(branchIds: string[], p: Period, customerId?: string) {
    const customer = customerId ? Prisma.sql`AND i.customer_id = ${customerId}::uuid` : Prisma.empty;
    return this.prisma.$queryRaw<SalesInvoiceRow[]>`
      SELECT i.id, i.number, i.invoice_date AS "invoiceDate", b.code AS "branchCode",
             i.customer_name AS "customerName", i.customer_gstin AS "customerGstin", i.status::text AS status,
             i.taxable_total::text AS taxable, i.cgst_total::text AS cgst, i.sgst_total::text AS sgst,
             i.igst_total::text AS igst, i.round_off::text AS "roundOff", i.grand_total::text AS "grandTotal",
             i.paid_total::text AS paid, i.credited_total::text AS credited
        FROM invoices i JOIN branches b ON b.id = i.branch_id
       WHERE ${inBranches(Prisma.sql`i.branch_id`, branchIds)} AND ${inPeriod(Prisma.sql`i.invoice_date`, p)} AND ${SALES} ${customer}
       ORDER BY i.invoice_date, i.number`;
  }

  async salesByDay(branchIds: string[], p: Period) {
    const rows = await this.prisma.$queryRaw<(Omit<SalesByDayRow, "bills"> & { bills: bigint })[]>`
      SELECT to_char((i.invoice_date AT TIME ZONE ${p.timeZone})::date, 'YYYY-MM-DD') AS day,
             COUNT(*) AS bills, SUM(i.taxable_total)::text AS taxable,
             SUM(i.cgst_total + i.sgst_total + i.igst_total)::text AS tax, SUM(i.grand_total)::text AS total
        FROM invoices i
       WHERE ${inBranches(Prisma.sql`i.branch_id`, branchIds)} AND ${inPeriod(Prisma.sql`i.invoice_date`, p)} AND ${LIVE} AND ${SALES}
       GROUP BY 1 ORDER BY 1`;
    return rows.map((r) => ({ ...r, bills: Number(r.bills) }));
  }

  async salesByCustomer(branchIds: string[], p: Period) {
    const rows = await this.prisma.$queryRaw<(Omit<SalesByCustomerRow, "bills"> & { bills: bigint })[]>`
      SELECT i.customer_id AS "customerId", COALESCE(c.name, 'Walk-in customers') AS name, c.mobile,
             COUNT(*) AS bills, SUM(i.taxable_total)::text AS taxable,
             SUM(i.cgst_total + i.sgst_total + i.igst_total)::text AS tax, SUM(i.grand_total)::text AS total,
             SUM(GREATEST(i.grand_total - i.paid_total - i.credited_total, 0))::text AS balance
        FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
       WHERE ${inBranches(Prisma.sql`i.branch_id`, branchIds)} AND ${inPeriod(Prisma.sql`i.invoice_date`, p)} AND ${LIVE} AND ${SALES}
       GROUP BY i.customer_id, c.name, c.mobile
       ORDER BY SUM(i.grand_total) DESC`;
    return rows.map((r) => ({ ...r, bills: Number(r.bills) }));
  }

  salesByItem(branchIds: string[], p: Period) {
    return this.prisma.$queryRaw<SalesByItemRow[]>`
      SELECT l.kind::text AS kind, MAX(l.sku) AS sku, MAX(l.description) AS description, MAX(l.unit) AS unit,
             SUM(l.quantity)::text AS quantity, SUM(l.returned_qty)::text AS "returnedQty",
             SUM(l.taxable)::text AS taxable, SUM(l.cgst + l.sgst + l.igst)::text AS tax, SUM(l.total)::text AS total
        FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id
       WHERE ${inBranches(Prisma.sql`i.branch_id`, branchIds)} AND ${inPeriod(Prisma.sql`i.invoice_date`, p)} AND ${LIVE} AND ${SALES}
       GROUP BY l.kind, COALESCE(l.item_id, l.labour_service_id), CASE WHEN l.item_id IS NULL AND l.labour_service_id IS NULL THEN l.description END
       ORDER BY SUM(l.total) DESC`;
  }

  async salesByCategory(branchIds: string[], p: Period) {
    const rows = await this.prisma.$queryRaw<(Omit<SalesByCategoryRow, "lines"> & { lines: bigint })[]>`
      SELECT CASE WHEN l.kind = 'LABOUR' THEN 'Labour' ELSE COALESCE(c.name, 'Uncategorised') END AS category,
             COUNT(*) AS lines, SUM(l.quantity)::text AS quantity, SUM(l.taxable)::text AS taxable,
             SUM(l.cgst + l.sgst + l.igst)::text AS tax, SUM(l.total)::text AS total
        FROM invoice_lines l
        JOIN invoices i ON i.id = l.invoice_id
        LEFT JOIN items it ON it.id = l.item_id
        LEFT JOIN item_categories c ON c.id = it.category_id
       WHERE ${inBranches(Prisma.sql`i.branch_id`, branchIds)} AND ${inPeriod(Prisma.sql`i.invoice_date`, p)} AND ${LIVE} AND ${SALES}
       GROUP BY 1 ORDER BY SUM(l.total) DESC`;
    return rows.map((r) => ({ ...r, lines: Number(r.lines) }));
  }

  async paymentsByMode(branchIds: string[], p: Period) {
    const rows = await this.prisma.$queryRaw<(Omit<PaymentsByModeRow, "receipts"> & { receipts: bigint })[]>`
      SELECT p.mode, COUNT(*) FILTER (WHERE p.kind IS NULL) AS receipts,
             COALESCE(SUM(p.amount) FILTER (WHERE p.amount > 0), 0)::text AS received,
             COALESCE(-SUM(p.amount) FILTER (WHERE p.amount < 0), 0)::text AS returned,
             SUM(p.amount)::text AS net
        FROM payments p
       WHERE ${inBranches(Prisma.sql`p.branch_id`, branchIds)} AND ${inPeriod(Prisma.sql`p.received_at`, p)}
       GROUP BY p.mode ORDER BY SUM(p.amount) DESC`;
    return rows.map((r) => ({ ...r, receipts: Number(r.receipts) }));
  }

  dayBook(branchIds: string[], p: Period) {
    return this.prisma.$queryRaw<DayBookRow[]>`
      SELECT * FROM (
        SELECT i.invoice_date AS at,
               CASE WHEN i.kind = 'OPENING_BALANCE' THEN (CASE WHEN i.status = 'CANCELLED' THEN 'Old dues (cancelled)' ELSE 'Old dues' END)
                    WHEN i.status = 'CANCELLED' THEN 'Sales invoice (cancelled)' ELSE 'Sales invoice' END AS type,
               i.number, COALESCE(i.customer_name, 'Walk-in') AS party, NULL::text AS mode,
               (CASE WHEN i.status = 'CANCELLED' THEN 0 ELSE i.grand_total END)::text AS value,
               '0' AS "moneyIn", '0' AS "moneyOut"
          FROM invoices i
         WHERE ${inBranches(Prisma.sql`i.branch_id`, branchIds)} AND ${inPeriod(Prisma.sql`i.invoice_date`, p)}
        UNION ALL
        SELECT p.received_at, CASE WHEN p.kind IS NULL THEN 'Receipt' WHEN p.kind = 'REFUND' THEN 'Refund' ELSE 'Receipt reversal' END,
               i.number, COALESCE(i.customer_name, 'Walk-in'), p.mode, NULL,
               GREATEST(p.amount, 0)::text, GREATEST(-p.amount, 0)::text
          FROM payments p JOIN invoices i ON i.id = p.invoice_id
         WHERE ${inBranches(Prisma.sql`p.branch_id`, branchIds)} AND ${inPeriod(Prisma.sql`p.received_at`, p)}
        UNION ALL
        SELECT cn.created_at, 'Credit note', cn.number, COALESCE(i.customer_name, 'Walk-in'), NULL, cn.total::text, '0', '0'
          FROM credit_notes cn JOIN invoices i ON i.id = cn.invoice_id
         WHERE ${inBranches(Prisma.sql`cn.branch_id`, branchIds)} AND ${inPeriod(Prisma.sql`cn.created_at`, p)}
      ) x
      ORDER BY at, number`;
  }

  async shifts(branchIds: string[], p: Period) {
    const rows = await this.prisma.$queryRaw<(Omit<ShiftReportRow, "bills"> & { bills: bigint })[]>`
      SELECT s.id, b.code AS "branchCode", s.counter, s.user_id AS "userId", s.opened_at AS "openedAt",
             s.closed_at AS "closedAt", s.status::text AS status, s.opening_cash::text AS "openingCash", s.counted,
             (SELECT COUNT(*) FROM invoices i WHERE i.shift_id = s.id AND ${LIVE}) AS bills,
             (SELECT COALESCE(SUM(i.grand_total), 0) FROM invoices i WHERE i.shift_id = s.id AND ${LIVE})::text AS sales,
             (SELECT COALESCE(SUM(pm.amount), 0) FROM payments pm WHERE pm.shift_id = s.id)::text AS "netPayments"
        FROM shifts s JOIN branches b ON b.id = s.branch_id
       WHERE ${inBranches(Prisma.sql`s.branch_id`, branchIds)} AND ${inPeriod(Prisma.sql`s.opened_at`, p)}
       ORDER BY s.opened_at`;
    return rows.map((r) => ({ ...r, bills: Number(r.bills) }));
  }

  gstInvoiceRates(branchIds: string[], p: Period) {
    return this.prisma.$queryRaw<GstInvoiceRateRow[]>`
      SELECT i.id, i.number, i.invoice_date AS date, i.customer_gstin AS "customerGstin",
             i.customer_name AS "customerName", i.place_of_supply AS "placeOfSupply", i.supply_type::text AS "supplyType",
             i.grand_total::text AS "grandTotal", i.round_off::text AS "roundOff", l.gst_rate::text AS rate,
             SUM(l.taxable)::text AS taxable, SUM(l.cgst)::text AS cgst, SUM(l.sgst)::text AS sgst, SUM(l.igst)::text AS igst
        FROM invoices i JOIN invoice_lines l ON l.invoice_id = i.id
       WHERE ${inBranches(Prisma.sql`i.branch_id`, branchIds)} AND ${inPeriod(Prisma.sql`i.invoice_date`, p)} AND ${LIVE} AND ${SALES}
       GROUP BY i.id, l.gst_rate
       ORDER BY i.invoice_date, i.number, l.gst_rate`;
  }

  gstCreditNoteRates(branchIds: string[], p: Period) {
    return this.prisma.$queryRaw<GstCreditNoteRateRow[]>`
      SELECT cn.id, cn.number, cn.created_at AS date, i.customer_gstin AS "customerGstin",
             i.customer_name AS "customerName", i.place_of_supply AS "placeOfSupply", i.supply_type::text AS "supplyType",
             cn.total::text AS "grandTotal", cn.round_off::text AS "roundOff", il.gst_rate::text AS rate,
             SUM(cl.taxable)::text AS taxable, SUM(cl.cgst)::text AS cgst, SUM(cl.sgst)::text AS sgst, SUM(cl.igst)::text AS igst,
             i.number AS "invoiceNumber", i.invoice_date AS "invoiceDate", i.grand_total::text AS "invoiceGrandTotal"
        FROM credit_notes cn
        JOIN credit_note_lines cl ON cl.credit_note_id = cn.id
        JOIN invoice_lines il ON il.id = cl.invoice_line_id
        JOIN invoices i ON i.id = cn.invoice_id
       WHERE ${inBranches(Prisma.sql`cn.branch_id`, branchIds)} AND ${inPeriod(Prisma.sql`cn.created_at`, p)}
       GROUP BY cn.id, i.id, il.gst_rate
       ORDER BY cn.created_at, cn.number, il.gst_rate`;
  }

  // HSN descriptions are per shop, so the lookup is limited to this business.
  hsnSummary(businessId: string, branchIds: string[], p: Period) {
    return this.prisma.$queryRaw<HsnRow[]>`
      SELECT x.hsn, (SELECT h.description FROM hsn_sac_codes h WHERE h.code = x.hsn AND h.business_id = ${businessId}::uuid AND h.deleted_at IS NULL LIMIT 1) AS description,
             x.kind, x.unit, x.rate::text AS rate, SUM(x.qty)::text AS quantity, SUM(x.taxable)::text AS taxable,
             SUM(x.cgst)::text AS cgst, SUM(x.sgst)::text AS sgst, SUM(x.igst)::text AS igst
        FROM (
          SELECT COALESCE(l.hsn_sac, '') AS hsn, l.kind::text AS kind, l.unit, l.gst_rate AS rate, l.quantity AS qty,
                 l.taxable, l.cgst, l.sgst, l.igst
            FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id
           WHERE ${inBranches(Prisma.sql`i.branch_id`, branchIds)} AND ${inPeriod(Prisma.sql`i.invoice_date`, p)} AND ${LIVE} AND ${SALES}
          UNION ALL
          SELECT COALESCE(il.hsn_sac, ''), il.kind::text, il.unit, il.gst_rate, -cl.quantity, -cl.taxable, -cl.cgst, -cl.sgst, -cl.igst
            FROM credit_note_lines cl
            JOIN credit_notes cn ON cn.id = cl.credit_note_id
            JOIN invoice_lines il ON il.id = cl.invoice_line_id
           WHERE ${inBranches(Prisma.sql`cn.branch_id`, branchIds)} AND ${inPeriod(Prisma.sql`cn.created_at`, p)}
        ) x
       GROUP BY x.hsn, x.kind, x.unit, x.rate
       ORDER BY x.hsn, x.rate`;
  }

  openInvoices(branchIds: string[], timeZone: string) {
    return this.prisma.$queryRaw<OpenDocumentRow[]>`
      SELECT i.customer_id AS "partyId", COALESCE(c.name, i.customer_name, 'Walk-in') AS party,
             COALESCE(c.mobile, i.customer_mobile) AS mobile,
             to_char((COALESCE(i.due_date, i.invoice_date) AT TIME ZONE ${timeZone})::date, 'YYYY-MM-DD') AS "dueDate",
             (i.grand_total - i.paid_total - i.credited_total)::text AS owed
        FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
       WHERE ${inBranches(Prisma.sql`i.branch_id`, branchIds)} AND ${LIVE}
         AND i.grand_total - i.paid_total - i.credited_total > 0`;
  }

  stockValuation(branchIds: string[]) {
    return this.prisma.$queryRaw<StockValuationRow[]>`
      SELECT i.id AS "itemId", i.sku, i.name, c.name AS category, i.unit::text AS unit,
             SUM(bs.on_hand)::text AS "onHand", i.purchase_price::text AS "purchasePrice", i.sale_price::text AS "salePrice",
             (SELECT MAX(l.created_at) FROM stock_ledger l
               WHERE l.item_id = i.id AND l.type = 'SALE' AND ${inBranches(Prisma.sql`l.branch_id`, branchIds)}) AS "lastSaleAt"
        FROM branch_stock bs
        JOIN items i ON i.id = bs.item_id
        LEFT JOIN item_categories c ON c.id = i.category_id
       WHERE ${inBranches(Prisma.sql`bs.branch_id`, branchIds)} AND i.deleted_at IS NULL
       GROUP BY i.id, c.name
      HAVING SUM(bs.on_hand) <> 0
       ORDER BY i.name`;
  }

  stockMovement(branchIds: string[], p: Period) {
    const inRange = inPeriod(Prisma.sql`l.created_at`, p);
    return this.prisma.$queryRaw<StockMovementRow[]>`
      SELECT * FROM (
        SELECT i.id AS "itemId", i.sku, i.name, i.unit::text AS unit,
               COALESCE(SUM(l.quantity) FILTER (WHERE l.created_at < ${p.start}), 0)::text AS opening,
               COALESCE(SUM(l.quantity) FILTER (WHERE ${inRange} AND l.quantity > 0), 0)::text AS inward,
               COALESCE(-SUM(l.quantity) FILTER (WHERE ${inRange} AND l.quantity < 0), 0)::text AS outward,
               COALESCE(-SUM(l.quantity) FILTER (WHERE ${inRange} AND l.type IN ('SALE', 'SALE_CANCEL', 'SALE_RETURN')), 0)::text AS sold,
               COUNT(*) FILTER (WHERE ${inRange}) AS moves
          FROM stock_ledger l JOIN items i ON i.id = l.item_id
         WHERE ${inBranches(Prisma.sql`l.branch_id`, branchIds)} AND l.created_at < ${p.end}
         GROUP BY i.id
      ) x
      WHERE x.moves > 0 OR x.opening::numeric <> 0
      ORDER BY x.name`;
  }

  customerPayments(branchIds: string[], p: Period) {
    return this.prisma.$queryRaw<CustomerPaymentRow[]>`
      SELECT p.id, p.received_at AS "receivedAt", p.mode, p.amount::text AS amount, p.kind, p.reference,
             i.number AS "invoiceNumber", COALESCE(i.customer_name, 'Walk-in') AS party
        FROM payments p JOIN invoices i ON i.id = p.invoice_id
       WHERE ${inBranches(Prisma.sql`p.branch_id`, branchIds)} AND ${inPeriod(Prisma.sql`p.received_at`, p)}
       ORDER BY p.received_at`;
  }

  async businessName(businessId: string) {
    const b = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { legalName: true, gstin: true },
    });
    return b ?? { legalName: "ERP Software", gstin: null };
  }
}
