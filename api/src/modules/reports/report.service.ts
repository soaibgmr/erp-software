import { inject, injectable } from "inversify";
import {
  AGEING_BUCKETS,
  ageingBucket,
  PAYMENT_METHOD_LABELS,
  REPORT_MAX_DAYS,
  reportDefinition,
  toPaise,
  type AgeingBucket,
  type PaymentMethod,
  type ReportCell,
  type ReportColumn,
  type ReportName,
  type ReportQuery,
  type ReportResult,
  type ReportTable,
  type TallyExportQuery,
} from "@erp-software/shared";
import { TYPES } from "../../config/ioc.types";
import { env } from "../../config/env";
import type { AuthContext } from "../../common/auth-context";
import { resolveBranchScope, type BranchScope } from "../../common/branch-scope";
import { badRequest, notFound } from "../../common/http-error";
import { startOfDayIn } from "../../utils/time";
import type { IBranchRepository } from "../branches/interfaces/ibranch.repository";
import { addDays, daysBetween, todayIn } from "../../common/date-only";
import { buildGstr1, classifyInvoice, type Gstr1Json } from "./gstr1";
import type { IReportRepository } from "./interfaces/ireport.repository";
import type { IReportService } from "./interfaces/ireport.service";
import type { GstInvoiceRateRow, OpenDocumentRow, Period } from "./report.types";
import { buildTallyXml, TALLY_LEDGERS, type TallyEntry, type TallyVoucher } from "./tally";

const money = (paise: number) => (paise / 100).toFixed(2);
const P = (v: string | null | undefined) => toPaise(v ?? "0");
const qty = (v: string | null | undefined) => Number(v ?? 0).toFixed(3);

const col = (key: string, label: string, type: ReportColumn["type"] = "text"): ReportColumn => ({ key, label, type });

// Totals row: sums every money / qty / int column of the given rows.
function totalsOf(columns: ReportColumn[], rows: Record<string, ReportCell>[]): Record<string, ReportCell> {
  const out: Record<string, ReportCell> = {};
  for (const c of columns) {
    if (c.type === "money") out[c.key] = money(rows.reduce((a, r) => a + P(r[c.key] as string | null), 0));
    else if (c.type === "qty")
      out[c.key] = (rows.reduce((a, r) => a + Math.round(Number(r[c.key] ?? 0) * 1000), 0) / 1000).toFixed(3);
    else if (c.type === "int") out[c.key] = rows.reduce((a, r) => a + Number(r[c.key] ?? 0), 0);
  }
  return out;
}

const table = (
  key: string,
  columns: ReportColumn[],
  rows: Record<string, ReportCell>[],
  title?: string,
  totals = true,
): ReportTable => ({
  key,
  ...(title && { title }),
  columns,
  rows,
  ...(totals && rows.length > 0 && { totals: totalsOf(columns, rows) }),
});

const modeLabel = (m: string | null) => (m ? (PAYMENT_METHOD_LABELS[m as PaymentMethod] ?? m) : null);

@injectable()
export class ReportService implements IReportService {
  constructor(
    @inject(TYPES.ReportRepository) private readonly reports: IReportRepository,
    @inject(TYPES.BranchRepository) private readonly branches: IBranchRepository,
  ) {}

  // from/to default to the month so far; both are inclusive calendar days in APP_TIMEZONE.
  period(from?: string, to?: string): Period {
    const timeZone = env.APP_TIMEZONE;
    const today = todayIn(timeZone);
    const toDay = to ?? today;
    const fromDay = from ?? `${toDay.slice(0, 8)}01`;
    if (fromDay > toDay) throw badRequest("From must be on or before To");
    if (daysBetween(fromDay, toDay) + 1 > REPORT_MAX_DAYS)
      throw badRequest(`Choose a period of at most ${REPORT_MAX_DAYS} days`);
    return {
      fromDay,
      toDay,
      start: startOfDayIn(fromDay, timeZone),
      end: startOfDayIn(addDays(toDay, 1), timeZone),
      timeZone,
    };
  }

  async run(
    auth: AuthContext,
    currentBranchId: string | undefined,
    name: string,
    query: ReportQuery,
  ): Promise<ReportResult> {
    const def = reportDefinition(name);
    if (!def) throw notFound("Report not found");
    const scope = await resolveBranchScope(this.branches, auth, query.branchId, currentBranchId);
    const p = this.period(query.from, query.to);
    const result = (tables: ReportTable[], notes: string[] = []): ReportResult => ({
      name: def.name,
      title:
        def.name === "sales-register" && query.groupBy !== "invoice"
          ? `${def.title} by ${groupLabel[query.groupBy]}`
          : def.title,
      from: def.dated ? p.fromDay : null,
      to: def.dated ? p.toDay : null,
      asOf: todayIn(p.timeZone),
      scope: { branchIds: scope.branchIds, label: scope.label },
      tables,
      notes,
    });
    if (!scope.branchIds.length) return result([]);

    switch (def.name as ReportName) {
      case "sales-register":
        return result(await this.salesRegister(scope, p, query));
      case "day-book":
        return result(await this.dayBook(scope, p));
      case "shift":
        return result(await this.shifts(scope, p));
      case "gstr1": {
        const { tables, notes } = await this.gstr1(scope, p);
        return result(tables, notes);
      }
      case "gstr3b":
        return result(await this.gstr3b(scope, p), [
          "Purchases are not recorded in this software, so input tax credit (table 4) is not shown. Take it from GSTR-2B on the GST portal.",
        ]);
      case "hsn-summary":
        return result([await this.hsnTable(scope, p)]);
      case "receivables-ageing":
        return result([
          this.ageing(await this.reports.openInvoices(scope.branchIds, p.timeZone), todayIn(p.timeZone), "Customer"),
        ]);
      case "stock-valuation":
        return result(
          [await this.stockValuation(scope, p)],
          ["Value at purchase price uses each item's purchase price from the item master."],
        );
      case "stock-movement":
        return result([await this.stockMovement(scope, p)]);
    }
  }

  // ---------- Sales ----------

  private async salesRegister(scope: BranchScope, p: Period, q: ReportQuery): Promise<ReportTable[]> {
    const multi = scope.branchIds.length > 1;
    switch (q.groupBy) {
      case "invoice": {
        const rows = await this.reports.salesInvoices(scope.branchIds, p, q.customerId);
        const columns = [
          col("invoiceDate", "Date", "datetime"),
          col("number", "Invoice"),
          ...(multi ? [col("branch", "Branch")] : []),
          col("customer", "Customer"),
          col("gstin", "GSTIN"),
          col("status", "Status"),
          col("taxable", "Taxable", "money"),
          col("cgst", "CGST", "money"),
          col("sgst", "SGST", "money"),
          col("igst", "IGST", "money"),
          col("roundOff", "Round off", "money"),
          col("total", "Total", "money"),
          col("credited", "Credit notes", "money"),
          col("paid", "Paid", "money"),
          col("balance", "Balance", "money"),
        ];
        return [
          table(
            "invoices",
            columns,
            rows.map((r) => {
              const live = r.status !== "CANCELLED";
              const z = (v: string) => (live ? money(P(v)) : "0.00");
              return {
                invoiceDate: r.invoiceDate.toISOString(),
                number: r.number,
                branch: r.branchCode,
                customer: r.customerName ?? "Walk-in",
                gstin: r.customerGstin,
                status: r.status,
                taxable: z(r.taxable),
                cgst: z(r.cgst),
                sgst: z(r.sgst),
                igst: z(r.igst),
                roundOff: z(r.roundOff),
                total: z(r.grandTotal),
                credited: z(r.credited),
                paid: z(r.paid),
                balance: live ? money(Math.max(P(r.grandTotal) - P(r.paid) - P(r.credited), 0)) : "0.00",
              };
            }),
          ),
        ];
      }
      case "day": {
        const rows = await this.reports.salesByDay(scope.branchIds, p);
        const columns = [
          col("day", "Date", "date"),
          col("bills", "Bills", "int"),
          col("taxable", "Taxable", "money"),
          col("tax", "GST", "money"),
          col("total", "Total", "money"),
        ];
        return [
          table(
            "days",
            columns,
            rows.map((r) => ({ ...r, taxable: money(P(r.taxable)), tax: money(P(r.tax)), total: money(P(r.total)) })),
          ),
        ];
      }
      case "customer": {
        const rows = await this.reports.salesByCustomer(scope.branchIds, p);
        const columns = [
          col("name", "Customer"),
          col("mobile", "Mobile"),
          col("bills", "Bills", "int"),
          col("taxable", "Taxable", "money"),
          col("tax", "GST", "money"),
          col("total", "Total", "money"),
          col("balance", "Unpaid", "money"),
        ];
        return [
          table(
            "customers",
            columns,
            rows.map((r) => ({
              name: r.name,
              mobile: r.mobile,
              bills: r.bills,
              taxable: money(P(r.taxable)),
              tax: money(P(r.tax)),
              total: money(P(r.total)),
              balance: money(P(r.balance)),
            })),
          ),
        ];
      }
      case "item": {
        const rows = await this.reports.salesByItem(scope.branchIds, p);
        const columns = [
          col("sku", "SKU"),
          col("description", "Item / service"),
          col("kind", "Type"),
          col("unit", "Unit"),
          col("quantity", "Qty sold", "qty"),
          col("returnedQty", "Qty returned", "qty"),
          col("taxable", "Taxable", "money"),
          col("tax", "GST", "money"),
          col("total", "Total", "money"),
        ];
        return [
          table(
            "items",
            columns,
            rows.map((r) => ({
              sku: r.sku,
              description: r.description,
              kind: r.kind === "LABOUR" ? "Labour" : "Part",
              unit: r.unit,
              quantity: qty(r.quantity),
              returnedQty: qty(r.returnedQty),
              taxable: money(P(r.taxable)),
              tax: money(P(r.tax)),
              total: money(P(r.total)),
            })),
          ),
        ];
      }
      case "category": {
        const rows = await this.reports.salesByCategory(scope.branchIds, p);
        const columns = [
          col("category", "Category"),
          col("lines", "Lines", "int"),
          col("quantity", "Qty", "qty"),
          col("taxable", "Taxable", "money"),
          col("tax", "GST", "money"),
          col("total", "Total", "money"),
        ];
        return [
          table(
            "categories",
            columns,
            rows.map((r) => ({
              ...r,
              quantity: qty(r.quantity),
              taxable: money(P(r.taxable)),
              tax: money(P(r.tax)),
              total: money(P(r.total)),
            })),
          ),
        ];
      }
      case "mode": {
        const rows = await this.reports.paymentsByMode(scope.branchIds, p);
        const columns = [
          col("mode", "Mode"),
          col("receipts", "Receipts", "int"),
          col("received", "Received", "money"),
          col("returned", "Refunded / reversed", "money"),
          col("net", "Net", "money"),
        ];
        return [
          table(
            "modes",
            columns,
            rows.map((r) => ({
              mode: modeLabel(r.mode),
              receipts: r.receipts,
              received: money(P(r.received)),
              returned: money(P(r.returned)),
              net: money(P(r.net)),
            })),
          ),
        ];
      }
    }
  }

  private async dayBook(scope: BranchScope, p: Period): Promise<ReportTable[]> {
    const rows = await this.reports.dayBook(scope.branchIds, p);
    const columns = [
      col("at", "Date", "datetime"),
      col("type", "Voucher"),
      col("number", "Number"),
      col("party", "Party"),
      col("mode", "Mode"),
      col("value", "Document value", "money"),
      col("moneyIn", "Money in", "money"),
      col("moneyOut", "Money out", "money"),
    ];
    return [
      table(
        "entries",
        columns,
        rows.map((r) => ({
          at: r.at.toISOString(),
          type: r.type,
          number: r.number,
          party: r.party,
          mode: modeLabel(r.mode),
          value: r.value == null ? null : money(P(r.value)),
          moneyIn: money(P(r.moneyIn)),
          moneyOut: money(P(r.moneyOut)),
        })),
      ),
    ];
  }

  private async shifts(scope: BranchScope, p: Period): Promise<ReportTable[]> {
    const rows = await this.reports.shifts(scope.branchIds, p);
    const users = await this.reports.userNames(rows.map((r) => r.userId));
    const columns = [
      col("openedAt", "Opened", "datetime"),
      col("closedAt", "Closed", "datetime"),
      ...(scope.branchIds.length > 1 ? [col("branch", "Branch")] : []),
      col("counter", "Counter"),
      col("user", "Cashier"),
      col("bills", "Bills", "int"),
      col("sales", "Sales", "money"),
      col("expected", "Expected", "money"),
      col("counted", "Counted", "money"),
      col("variance", "Variance", "money"),
    ];
    return [
      table(
        "shifts",
        columns,
        rows.map((r) => {
          const expected = P(r.netPayments) + P(r.openingCash);
          const counted = r.counted ? Object.values(r.counted).reduce((a, v) => a + P(v), 0) : null;
          return {
            openedAt: r.openedAt.toISOString(),
            closedAt: r.closedAt?.toISOString() ?? null,
            branch: r.branchCode,
            counter: r.counter,
            user: users.get(r.userId)?.name ?? null,
            bills: r.bills,
            sales: money(P(r.sales)),
            expected: money(expected),
            counted: counted == null ? null : money(counted),
            variance: counted == null ? null : money(counted - expected),
          };
        }),
      ),
    ];
  }

  // ---------- GST ----------

  // GSTR-1 is filed per GSTIN: the branches in scope must share one.
  private async gstinFor(scope: BranchScope): Promise<string> {
    const business = await this.reports.businessName(scope.businessId);
    const gstins = new Set(scope.branches.map((b) => b.gstin ?? business.gstin));
    if (gstins.size > 1) throw badRequest("These branches file under different GSTINs. Choose one branch.");
    const [gstin] = gstins;
    if (!gstin) throw badRequest("Add the business GSTIN in Settings → Business profile first");
    return gstin;
  }

  async gstr1Json(
    auth: AuthContext,
    currentBranchId: string | undefined,
    query: ReportQuery,
  ): Promise<{ fileName: string; json: Gstr1Json }> {
    const scope = await resolveBranchScope(this.branches, auth, query.branchId, currentBranchId);
    const p = this.period(query.from, query.to);
    const gstin = await this.gstinFor(scope);
    const fp = `${p.toDay.slice(5, 7)}${p.toDay.slice(0, 4)}`;
    const [invoices, creditNotes, hsn] = await Promise.all([
      this.reports.gstInvoiceRates(scope.branchIds, p),
      this.reports.gstCreditNoteRates(scope.branchIds, p),
      this.reports.hsnSummary(scope.businessId, scope.branchIds, p),
    ]);
    return {
      fileName: `GSTR1_${gstin}_${fp}.json`,
      json: buildGstr1({ gstin, period: fp, timeZone: p.timeZone, invoices, creditNotes, hsn }),
    };
  }

  private async gstr1(scope: BranchScope, p: Period): Promise<{ tables: ReportTable[]; notes: string[] }> {
    const gstin = await this.gstinFor(scope);
    const [invoices, creditNotes] = await Promise.all([
      this.reports.gstInvoiceRates(scope.branchIds, p),
      this.reports.gstCreditNoteRates(scope.branchIds, p),
    ]);
    const taxCols = [
      col("taxable", "Taxable", "money"),
      col("igst", "IGST", "money"),
      col("cgst", "CGST", "money"),
      col("sgst", "SGST", "money"),
    ];
    const taxOf = (r: { taxable: string; igst: string; cgst: string; sgst: string }, sign = 1) => ({
      taxable: money(sign * P(r.taxable)),
      igst: money(sign * P(r.igst)),
      cgst: money(sign * P(r.cgst)),
      sgst: money(sign * P(r.sgst)),
    });

    const docRows = (rows: GstInvoiceRateRow[], extra: (r: GstInvoiceRateRow) => Record<string, ReportCell>) =>
      rows.map((r) => ({
        ...extra(r),
        date: r.date.toISOString(),
        number: r.number,
        pos: r.placeOfSupply,
        rate: Number(r.rate),
        ...taxOf(r),
      }));

    const b2bRows = invoices.filter((r) => classifyInvoice(r) === "B2B");
    const b2clRows = invoices.filter((r) => classifyInvoice(r) === "B2CL");
    const b2csRows = invoices.filter((r) => classifyInvoice(r) === "B2CS");
    const cnSection = (r: (typeof creditNotes)[number]) => classifyInvoice({ ...r, grandTotal: r.invoiceGrandTotal });
    const cdnrRows = creditNotes.filter((r) => cnSection(r) === "B2B");
    const cdnurRows = creditNotes.filter((r) => cnSection(r) === "B2CL");
    const b2csNotes = creditNotes.filter((r) => cnSection(r) === "B2CS");

    // B2CS: per place of supply and rate, net of credit notes on B2CS invoices.
    const b2cs = new Map<
      string,
      { pos: string; type: string; rate: number; paise: [number, number, number, number] }
    >();
    for (const [r, sign] of [
      ...b2csRows.map((row) => [row, 1] as const),
      ...b2csNotes.map((row) => [row, -1] as const),
    ]) {
      const key = `${r.placeOfSupply}|${r.supplyType}|${r.rate}`;
      const e = b2cs.get(key) ?? {
        pos: r.placeOfSupply,
        type: r.supplyType === "INTER_STATE" ? "Inter-state" : "Intra-state",
        rate: Number(r.rate),
        paise: [0, 0, 0, 0],
      };
      e.paise[0] += sign * P(r.taxable);
      e.paise[1] += sign * P(r.igst);
      e.paise[2] += sign * P(r.cgst);
      e.paise[3] += sign * P(r.sgst);
      b2cs.set(key, e);
    }

    const docCols = [
      col("date", "Date", "datetime"),
      col("number", "Number"),
      col("pos", "Place of supply"),
      col("rate", "Rate %", "percent"),
      ...taxCols,
    ];
    const count = (rows: { id: string }[]) => new Set(rows.map((r) => r.id)).size;
    const sum = (rows: { taxable: string; igst: string; cgst: string; sgst: string }[], sign = 1) =>
      taxOf(
        {
          taxable: money(rows.reduce((a, r) => a + P(r.taxable), 0)),
          igst: money(rows.reduce((a, r) => a + P(r.igst), 0)),
          cgst: money(rows.reduce((a, r) => a + P(r.cgst), 0)),
          sgst: money(rows.reduce((a, r) => a + P(r.sgst), 0)),
        },
        sign,
      );
    const b2csList = [...b2cs.values()];
    const b2csSum = {
      taxable: money(b2csList.reduce((a, e) => a + e.paise[0], 0)),
      igst: money(b2csList.reduce((a, e) => a + e.paise[1], 0)),
      cgst: money(b2csList.reduce((a, e) => a + e.paise[2], 0)),
      sgst: money(b2csList.reduce((a, e) => a + e.paise[3], 0)),
    };

    const summary = table(
      "summary",
      [col("section", "Section"), col("documents", "Documents", "int"), ...taxCols],
      [
        { section: "4A – B2B invoices", documents: count(b2bRows), ...sum(b2bRows) },
        { section: "5A – B2C large invoices", documents: count(b2clRows), ...sum(b2clRows) },
        { section: "7 – B2C small (net of their credit notes)", documents: count(b2csRows), ...b2csSum },
        { section: "9B – Credit notes, registered", documents: count(cdnrRows), ...sum(cdnrRows, -1) },
        { section: "9B – Credit notes, unregistered (B2CL)", documents: count(cdnurRows), ...sum(cdnurRows, -1) },
      ],
      "Summary",
    );

    return {
      tables: [
        summary,
        table(
          "b2b",
          [col("gstin", "Customer GSTIN"), col("customer", "Customer"), ...docCols],
          docRows(b2bRows, (r) => ({ gstin: r.customerGstin, customer: r.customerName })),
          "B2B",
        ),
        table(
          "b2cl",
          docCols,
          docRows(b2clRows, () => ({})),
          "B2C large",
        ),
        table(
          "b2cs",
          [col("pos", "Place of supply"), col("type", "Supply"), col("rate", "Rate %", "percent"), ...taxCols],
          b2csList.map((e) => ({
            pos: e.pos,
            type: e.type,
            rate: e.rate,
            taxable: money(e.paise[0]),
            igst: money(e.paise[1]),
            cgst: money(e.paise[2]),
            sgst: money(e.paise[3]),
          })),
          "B2C small",
        ),
        table(
          "cdnr",
          [col("gstin", "Customer GSTIN"), col("invoice", "Against invoice"), ...docCols],
          creditNotes
            .filter((r) => cnSection(r) !== "B2CS")
            .map((r) => ({
              gstin: r.customerGstin,
              invoice: r.invoiceNumber,
              date: r.date.toISOString(),
              number: r.number,
              pos: r.placeOfSupply,
              rate: Number(r.rate),
              ...taxOf(r),
            })),
          "Credit notes",
        ),
        await this.hsnTable(scope, p, "HSN summary"),
      ],
      notes: [
        `GSTIN ${gstin}. Download the portal JSON for the GST offline tool; return period ${p.toDay.slice(5, 7)}/${p.toDay.slice(0, 4)}.`,
        "B2C large = unregistered, inter-state, invoice value above ₹1,00,000.",
      ],
    };
  }

  private async gstr3b(scope: BranchScope, p: Period): Promise<ReportTable[]> {
    const [invoices, creditNotes] = await Promise.all([
      this.reports.gstInvoiceRates(scope.branchIds, p),
      this.reports.gstCreditNoteRates(scope.branchIds, p),
    ]);
    type Acc = { taxable: number; igst: number; cgst: number; sgst: number };
    const zero = (): Acc => ({ taxable: 0, igst: 0, cgst: 0, sgst: 0 });
    const add = (a: Acc, r: { taxable: string; igst: string; cgst: string; sgst: string }, sign = 1) => {
      a.taxable += sign * P(r.taxable);
      a.igst += sign * P(r.igst);
      a.cgst += sign * P(r.cgst);
      a.sgst += sign * P(r.sgst);
    };
    const taxable = zero();
    const nil = zero();
    const interUnreg = new Map<string, Acc>();
    for (const [r, sign] of [
      ...invoices.map((row) => [row, 1] as const),
      ...creditNotes.map((row) => [row, -1] as const),
    ]) {
      add(Number(r.rate) > 0 ? taxable : nil, r, sign);
      if (r.supplyType === "INTER_STATE" && !r.customerGstin && Number(r.rate) > 0) {
        const e = interUnreg.get(r.placeOfSupply) ?? zero();
        add(e, r, sign);
        interUnreg.set(r.placeOfSupply, e);
      }
    }

    const fmt = (a: Acc) => ({
      taxable: money(a.taxable),
      igst: money(a.igst),
      cgst: money(a.cgst),
      sgst: money(a.sgst),
    });
    const taxCols = [
      col("taxable", "Taxable", "money"),
      col("igst", "IGST", "money"),
      col("cgst", "CGST", "money"),
      col("sgst", "SGST", "money"),
    ];

    return [
      table(
        "outward",
        [col("head", "Nature of supplies"), ...taxCols],
        [
          { head: "3.1(a) Outward taxable supplies", ...fmt(taxable) },
          { head: "3.1(c) Nil rated / exempted", ...fmt(nil) },
        ],
        "3.1 Outward supplies (net of credit notes)",
        false,
      ),
      table(
        "inter-state-unregistered",
        [col("pos", "Place of supply"), col("taxable", "Taxable", "money"), col("igst", "IGST", "money")],
        [...interUnreg].map(([pos, a]) => ({ pos, taxable: money(a.taxable), igst: money(a.igst) })),
        "3.2 Inter-state supplies to unregistered persons",
      ),
      table(
        "output-tax",
        [
          col("head", "Details"),
          col("igst", "IGST", "money"),
          col("cgst", "CGST", "money"),
          col("sgst", "SGST", "money"),
        ],
        [{ head: "Output tax (before input tax credit)", ...fmt(taxable) }].map(({ taxable: _t, ...r }) => r),
        "Tax on outward supplies",
        false,
      ),
    ];
  }

  private async hsnTable(scope: BranchScope, p: Period, title?: string): Promise<ReportTable> {
    const rows = await this.reports.hsnSummary(scope.businessId, scope.branchIds, p);
    const columns = [
      col("hsn", "HSN / SAC"),
      col("description", "Description"),
      col("unit", "Unit"),
      col("quantity", "Qty", "qty"),
      col("rate", "Rate %", "percent"),
      col("taxable", "Taxable", "money"),
      col("igst", "IGST", "money"),
      col("cgst", "CGST", "money"),
      col("sgst", "SGST", "money"),
      col("total", "Total value", "money"),
    ];
    return table(
      "hsn",
      columns,
      rows.map((r) => ({
        hsn: r.hsn || "—",
        description: r.description,
        unit: r.kind === "LABOUR" ? "Service" : r.unit,
        quantity: qty(r.quantity),
        rate: Number(r.rate),
        taxable: money(P(r.taxable)),
        igst: money(P(r.igst)),
        cgst: money(P(r.cgst)),
        sgst: money(P(r.sgst)),
        total: money(P(r.taxable) + P(r.igst) + P(r.cgst) + P(r.sgst)),
      })),
      title,
    );
  }

  // ---------- Ageing ----------

  ageing(rows: OpenDocumentRow[], today: string, partyLabel: string): ReportTable {
    const byParty = new Map<
      string,
      { party: string; mobile: string | null; docs: number; paise: Record<AgeingBucket, number> }
    >();
    for (const r of rows) {
      const owed = P(r.owed);
      if (owed <= 0) continue;
      const key = r.partyId ?? `name:${r.party}`;
      const e = byParty.get(key) ?? {
        party: r.party,
        mobile: r.mobile,
        docs: 0,
        paise: Object.fromEntries(AGEING_BUCKETS.map((b) => [b.key, 0])) as Record<AgeingBucket, number>,
      };
      e.docs += 1;
      e.paise[ageingBucket(daysBetween(r.dueDate, today))] += owed;
      byParty.set(key, e);
    }
    const columns = [
      col("party", partyLabel),
      col("mobile", "Mobile"),
      col("documents", "Bills", "int"),
      ...AGEING_BUCKETS.map((b) => col(b.key, b.label, "money")),
      col("total", "Total", "money"),
    ];
    const out = [...byParty.values()]
      .map((e) => ({
        party: e.party,
        mobile: e.mobile,
        documents: e.docs,
        ...Object.fromEntries(AGEING_BUCKETS.map((b) => [b.key, money(e.paise[b.key])])),
        total: money(Object.values(e.paise).reduce((a, b) => a + b, 0)),
      }))
      .sort((a, b) => P(b.total) - P(a.total));
    return table("ageing", columns, out);
  }

  // ---------- Stock ----------

  private async stockValuation(scope: BranchScope, p: Period): Promise<ReportTable> {
    const rows = await this.reports.stockValuation(scope.branchIds);
    const now = new Date();
    const columns = [
      col("sku", "SKU"),
      col("name", "Item"),
      col("category", "Category"),
      col("unit", "Unit"),
      col("onHand", "On hand", "qty"),
      col("purchasePrice", "Cost", "money"),
      col("value", "Value at cost", "money"),
      col("saleValue", "Value at sale price", "money"),
      col("lastSaleAt", "Last sold", "date"),
      col("daysSinceSale", "Days since sale", "int"),
    ];
    const valueAt = (onHand: string, price: string) => Math.round(Number(onHand) * P(price));
    return table(
      "items",
      columns,
      rows.map((r) => ({
        sku: r.sku,
        name: r.name,
        category: r.category,
        unit: r.unit,
        onHand: qty(r.onHand),
        purchasePrice: money(P(r.purchasePrice)),
        value: money(valueAt(r.onHand, r.purchasePrice)),
        saleValue: money(valueAt(r.onHand, r.salePrice)),
        lastSaleAt: r.lastSaleAt ? todayIn(p.timeZone, r.lastSaleAt) : null,
        daysSinceSale: r.lastSaleAt ? daysBetween(todayIn(p.timeZone, r.lastSaleAt), todayIn(p.timeZone, now)) : null,
      })),
    );
  }

  private async stockMovement(scope: BranchScope, p: Period): Promise<ReportTable> {
    const rows = await this.reports.stockMovement(scope.branchIds, p);
    const columns = [
      col("sku", "SKU"),
      col("name", "Item"),
      col("unit", "Unit"),
      col("opening", "Opening", "qty"),
      col("inward", "In", "qty"),
      col("outward", "Out", "qty"),
      col("closing", "Closing", "qty"),
      col("sold", "Net sold", "qty"),
    ];
    return table(
      "items",
      columns,
      rows.map((r) => ({
        sku: r.sku,
        name: r.name,
        unit: r.unit,
        opening: qty(r.opening),
        inward: qty(r.inward),
        outward: qty(r.outward),
        closing: (
          (Math.round(Number(r.opening) * 1000) +
            Math.round(Number(r.inward) * 1000) -
            Math.round(Number(r.outward) * 1000)) /
          1000
        ).toFixed(3),
        sold: qty(r.sold),
      })),
    );
  }

  // ---------- Tally ----------

  async tallyExport(
    auth: AuthContext,
    currentBranchId: string | undefined,
    query: TallyExportQuery,
  ): Promise<{ fileName: string; xml: string; count: number }> {
    const scope = await resolveBranchScope(this.branches, auth, query.branchId, currentBranchId);
    const p = this.period(query.from, query.to);
    const kinds = new Set(query.vouchers);
    const vouchers: TallyVoucher[] = [];
    const day = (d: Date) => todayIn(p.timeZone, d);
    const ids = scope.branchIds;

    const taxEntries = (
      r: { rate: string; taxable: string; cgst: string; sgst: string; igst: string },
      base: string,
      cgst: string,
      sgst: string,
      igst: string,
      sign: 1 | -1,
    ): TallyEntry[] => [
      { ledger: base, paise: sign * P(r.taxable) },
      { ledger: cgst, paise: sign * P(r.cgst) },
      { ledger: sgst, paise: sign * P(r.sgst) },
      { ledger: igst, paise: sign * P(r.igst) },
    ];
    const grouped = <T extends { id: string }>(rows: T[]) => {
      const m = new Map<string, T[]>();
      for (const r of rows) m.set(r.id, [...(m.get(r.id) ?? []), r]);
      return [...m.values()];
    };
    const L = TALLY_LEDGERS;

    if (ids.length && kinds.has("sales")) {
      const [invoices, notes] = await Promise.all([
        this.reports.gstInvoiceRates(ids, p),
        this.reports.gstCreditNoteRates(ids, p),
      ]);
      for (const doc of grouped(invoices)) {
        const h = doc[0]!;
        const party = h.customerName ?? L.walkIn;
        vouchers.push({
          type: "Sales",
          date: day(h.date),
          number: h.number,
          party,
          entries: [
            { ledger: party, paise: P(h.grandTotal) },
            ...doc.flatMap((r) => taxEntries(r, L.sales(r.rate), L.outputCgst, L.outputSgst, L.outputIgst, -1)),
          ],
        });
      }
      for (const doc of grouped(notes)) {
        const h = doc[0]!;
        const party = h.customerName ?? L.walkIn;
        vouchers.push({
          type: "Credit Note",
          date: day(h.date),
          number: h.number,
          party,
          narration: `Against ${h.invoiceNumber}`,
          entries: [
            { ledger: party, paise: -P(h.grandTotal) },
            ...doc.flatMap((r) => taxEntries(r, L.sales(r.rate), L.outputCgst, L.outputSgst, L.outputIgst, 1)),
          ],
        });
      }
    }

    if (ids.length && kinds.has("payments")) {
      const cashOrBank = (mode: string) => (mode === "CASH" ? L.cash : L.bank);
      const received = await this.reports.customerPayments(ids, p);
      for (const r of received) {
        const amount = P(r.amount);
        const party = r.party === "Walk-in" ? L.walkIn : r.party;
        vouchers.push({
          // Money in is a Receipt; a refund or reversal (negative) is a Payment back to the customer.
          type: amount >= 0 ? "Receipt" : "Payment",
          date: day(r.receivedAt),
          number: r.reference ? `${r.invoiceNumber}/${r.reference}` : r.invoiceNumber,
          party,
          narration: `${modeLabel(r.mode)} ${r.kind ? r.kind.toLowerCase() : "receipt"} for ${r.invoiceNumber}`,
          entries: [
            { ledger: cashOrBank(r.mode), paise: amount },
            { ledger: party, paise: -amount },
          ],
        });
      }
    }

    vouchers.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
    const business = await this.reports.businessName(scope.businessId);
    return {
      fileName: `tally_${p.fromDay.replace(/-/g, "")}-${p.toDay.replace(/-/g, "")}.xml`,
      xml: buildTallyXml(business.legalName, vouchers),
      count: vouchers.length,
    };
  }
}

const groupLabel: Record<ReportQuery["groupBy"], string> = {
  invoice: "invoice",
  day: "day",
  customer: "customer",
  item: "item",
  category: "category",
  mode: "payment mode",
};
