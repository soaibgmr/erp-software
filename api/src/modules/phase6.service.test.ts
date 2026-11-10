import "reflect-metadata";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { reportQuerySchema, tallyExportQuerySchema, type ReportResult } from "@automobile/shared";
import { HttpError } from "../common/http-error";
import { buildXlsx } from "../common/xlsx";
import { authFor, branch, ids, stub } from "../test/fakes";
import type { IBranchRepository } from "./branches/interfaces/ibranch.repository";
import type { IDashboardRepository } from "./dashboard/interfaces/idashboard.repository";
import { DashboardService } from "./dashboard/dashboard.service";
import { todayIn, addDays } from "../common/date-only";
import { buildGstr1, classifyInvoice, gstDate } from "./reports/gstr1";
import type { IReportRepository } from "./reports/interfaces/ireport.repository";
import { reportToCsv } from "./reports/report.export";
import { ReportService } from "./reports/report.service";
import type { GstCreditNoteRateRow, GstInvoiceRateRow } from "./reports/report.types";
import { balance, buildTallyXml, TALLY_LEDGERS } from "./reports/tally";
import type { IStockService } from "./stock/interfaces/istock.service";

async function expectHttp(promise: Promise<unknown>, status: number) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(HttpError);
  expect((err as HttpError).status).toBe(status);
}

const inv = (o: Partial<GstInvoiceRateRow>): GstInvoiceRateRow => ({
  id: "i1",
  number: "INV-26-00001",
  date: new Date("2026-11-09T06:30:00Z"),
  customerGstin: null,
  customerName: null,
  placeOfSupply: "32",
  supplyType: "INTRA_STATE",
  grandTotal: "4814.00",
  roundOff: "-0.40",
  rate: "18.00",
  taxable: "4080.00",
  cgst: "367.20",
  sgst: "367.20",
  igst: "0.00",
  ...o,
});

describe("GSTR-1", () => {
  it("classifies B2B, B2C large (inter-state above ₹1 lakh) and B2C small", () => {
    expect(classifyInvoice({ customerGstin: "32AAAAA0000A1Z5", supplyType: "INTRA_STATE", grandTotal: "10.00" })).toBe(
      "B2B",
    );
    expect(classifyInvoice({ customerGstin: null, supplyType: "INTER_STATE", grandTotal: "100000.01" })).toBe("B2CL");
    expect(classifyInvoice({ customerGstin: null, supplyType: "INTER_STATE", grandTotal: "100000.00" })).toBe("B2CS");
    expect(classifyInvoice({ customerGstin: null, supplyType: "INTRA_STATE", grandTotal: "500000.00" })).toBe("B2CS");
  });

  it("formats dates as dd-mm-yyyy in the app timezone", () => {
    // 20:00 UTC on the 9th is already the 10th in India.
    expect(gstDate(new Date("2026-11-09T20:00:00Z"), "Asia/Kolkata")).toBe("10-11-2026");
  });

  it("builds portal sections and nets B2CS credit notes", () => {
    const b2b = [
      inv({ id: "a", number: "INV-1", customerGstin: "32AAAAA0000A1Z5", rate: "18.00" }),
      inv({
        id: "a",
        number: "INV-1",
        customerGstin: "32AAAAA0000A1Z5",
        rate: "28.00",
        taxable: "100.00",
        cgst: "14.00",
        sgst: "14.00",
      }),
    ];
    const b2cl = inv({
      id: "b",
      number: "INV-2",
      supplyType: "INTER_STATE",
      placeOfSupply: "29",
      grandTotal: "150000.00",
      taxable: "127118.64",
      cgst: "0",
      sgst: "0",
      igst: "22881.36",
    });
    const small = inv({
      id: "c",
      number: "INV-3",
      taxable: "1000.00",
      cgst: "90.00",
      sgst: "90.00",
      grandTotal: "1180.00",
    });
    const note: GstCreditNoteRateRow = {
      ...inv({ id: "n", number: "CN-1", taxable: "200.00", cgst: "18.00", sgst: "18.00", grandTotal: "236.00" }),
      invoiceNumber: "INV-3",
      invoiceDate: new Date("2026-11-01T06:30:00Z"),
      invoiceGrandTotal: "1180.00",
    };
    const json = buildGstr1({
      gstin: "32BBBBB0000B1Z5",
      period: "112026",
      timeZone: "Asia/Kolkata",
      invoices: [...b2b, b2cl, small],
      creditNotes: [note],
      hsn: [
        {
          hsn: "8708",
          description: "Parts",
          kind: "ITEM",
          unit: "PAIR",
          rate: "18.00",
          quantity: "2.000",
          taxable: "800.00",
          cgst: "72.00",
          sgst: "72.00",
          igst: "0.00",
        },
      ],
    });

    expect(json.fp).toBe("112026");
    expect(json.b2b).toHaveLength(1);
    expect(json.b2b[0]!.ctin).toBe("32AAAAA0000A1Z5");
    expect((json.b2b[0]!.inv[0] as { itms: unknown[]; idt: string }).itms).toHaveLength(2);
    expect((json.b2b[0]!.inv[0] as { idt: string }).idt).toBe("09-11-2026");
    expect(json.b2cl).toEqual([{ pos: "29", inv: [expect.objectContaining({ inum: "INV-2", val: 150000 })] }]);
    // B2CS: 1000 sold − 200 credited at 18% intra-state.
    expect(json.b2cs).toEqual([
      { sply_ty: "INTRA", pos: "32", typ: "OE", rt: 18, txval: 800, iamt: 0, camt: 72, samt: 72, csamt: 0 },
    ]);
    // Credit notes on B2CS invoices don't go to CDNUR.
    expect(json.cdnur).toHaveLength(0);
    expect(json.cdnr).toHaveLength(0);
    expect(json.hsn.data[0]).toMatchObject({ hsn_sc: "8708", uqc: "PRS", qty: 2, rt: 18, txval: 800 });
  });
});

describe("Tally export", () => {
  it("puts any residue on Round Off so every voucher balances", () => {
    const entries = balance([
      { ledger: "Cash Sales", paise: 481400 },
      { ledger: TALLY_LEDGERS.sales("18.00"), paise: -408000 },
      { ledger: TALLY_LEDGERS.outputCgst, paise: -36720 },
      { ledger: TALLY_LEDGERS.outputSgst, paise: -36720 },
      { ledger: TALLY_LEDGERS.outputIgst, paise: 0 },
    ]);
    expect(entries.reduce((a, e) => a + e.paise, 0)).toBe(0);
    expect(entries.find((e) => e.ledger === TALLY_LEDGERS.roundOff)?.paise).toBe(40);
    expect(entries.some((e) => e.ledger === TALLY_LEDGERS.outputIgst)).toBe(false);
  });

  it("writes debits negative with ISDEEMEDPOSITIVE=Yes and escapes names", () => {
    const xml = buildTallyXml("A & B Motors", [
      {
        type: "Receipt",
        date: "2026-11-09",
        number: "INV-1",
        party: "Ravi <Fleet>",
        entries: [
          { ledger: "Cash", paise: 50000 },
          { ledger: "Ravi <Fleet>", paise: -50000 },
        ],
      },
    ]);
    expect(xml).toContain("<SVCURRENTCOMPANY>A &amp; B Motors</SVCURRENTCOMPANY>");
    expect(xml).toContain("<DATE>20261109</DATE>");
    expect(xml).toContain(
      "<LEDGERNAME>Cash</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><ISPARTYLEDGER>No</ISPARTYLEDGER><AMOUNT>-500.00</AMOUNT>",
    );
    expect(xml).toContain(
      "<LEDGERNAME>Ravi &lt;Fleet&gt;</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><ISPARTYLEDGER>Yes</ISPARTYLEDGER><AMOUNT>500.00</AMOUNT>",
    );
  });

  it("validates the voucher list", () => {
    expect(tallyExportQuerySchema.parse({}).vouchers).toEqual(["sales", "payments"]);
    expect(tallyExportQuerySchema.parse({ vouchers: "payments,sales,payments" }).vouchers).toEqual([
      "payments",
      "sales",
    ]);
    expect(tallyExportQuerySchema.safeParse({ vouchers: "sales,stock" }).success).toBe(false);
  });
});

describe("Report exports", () => {
  it("writes a zip whose sheet holds the cells", () => {
    const buf = buildXlsx([
      {
        name: "Sales: Nov/26",
        rows: [
          ["Item", "Qty"],
          ["Brake pad <front>", 2.5],
        ],
      },
    ]);
    expect(buf.readUInt32LE(0)).toBe(0x04034b50);
    // Walk the local file headers to the sheet and inflate it.
    let offset = 0;
    const files = new Map<string, string>();
    while (buf.readUInt32LE(offset) === 0x04034b50) {
      const size = buf.readUInt32LE(offset + 18);
      const nameLen = buf.readUInt16LE(offset + 26);
      const name = buf.toString("utf8", offset + 30, offset + 30 + nameLen);
      const start = offset + 30 + nameLen;
      files.set(name, inflateRawSync(buf.subarray(start, start + size)).toString("utf8"));
      offset = start + size;
    }
    expect(files.get("xl/workbook.xml")).toContain('name="Sales  Nov 26"');
    const sheet = files.get("xl/worksheets/sheet1.xml")!;
    expect(sheet).toContain("Brake pad &lt;front&gt;");
    expect(sheet).toContain('<c r="B2"><v>2.5</v></c>');
  });

  it("CSV has a BOM, the header line and a Total row", () => {
    const result: ReportResult = {
      name: "sales-register",
      title: "Sales register",
      from: "2026-11-01",
      to: "2026-11-09",
      asOf: "2026-11-09",
      scope: { branchIds: [ids.branchA], label: "Main" },
      notes: [],
      tables: [
        {
          key: "days",
          columns: [
            { key: "day", label: "Date", type: "date" },
            { key: "total", label: "Total", type: "money" },
          ],
          rows: [{ day: "2026-11-09", total: "1,0" }],
          totals: { total: "10.00" },
        },
      ],
    };
    const csv = reportToCsv(result);
    expect(csv.startsWith("﻿Sales register · Main · 2026-11-01 to 2026-11-09")).toBe(true);
    expect(csv).toContain('2026-11-09,"1,0"');
    expect(csv.endsWith("Total,10")).toBe(true);
  });
});

describe("ReportService", () => {
  const service = (reports: Partial<IReportRepository> = {}, branches: Partial<IBranchRepository> = {}) =>
    new ReportService(
      stub<IReportRepository>(reports),
      stub<IBranchRepository>({
        findById: async (id) => branch(id),
        list: async () => [branch(ids.branchA), branch(ids.branchB)],
        ...branches,
      }),
    );

  it("defaults to the month so far and caps the period", () => {
    const s = service();
    const p = s.period(undefined, "2026-11-09");
    expect([p.fromDay, p.toDay]).toEqual(["2026-11-01", "2026-11-09"]);
    expect(p.end.getTime() - p.start.getTime()).toBe(9 * 86_400_000);
    expect(() => s.period("2025-01-01", "2026-11-09")).toThrow(HttpError);
  });

  it("refuses unknown reports and branches the user can't access", async () => {
    const q = reportQuerySchema.parse({});
    await expectHttp(service().run(authFor("owner"), ids.branchA, "nope", q), 404);
    await expectHttp(service().run(authFor("manager"), ids.branchA, "day-book", { ...q, branchId: ids.branchB }), 403);
  });

  it("buckets receivables by days past due, per customer", () => {
    const today = "2026-11-09";
    const t = service().ageing(
      [
        { partyId: "c1", party: "Ravi", mobile: null, dueDate: "2026-11-20", owed: "100.00" },
        { partyId: "c1", party: "Ravi", mobile: null, dueDate: "2026-10-01", owed: "50.00" },
        { partyId: null, party: "Walk-in", mobile: null, dueDate: "2026-07-01", owed: "25.00" },
      ],
      today,
      "Customer",
    );
    expect(t.rows[0]).toMatchObject({
      party: "Ravi",
      documents: 2,
      current: "100.00",
      d31_60: "50.00",
      total: "150.00",
    });
    expect(t.rows[1]).toMatchObject({ party: "Walk-in", d90_plus: "25.00" });
    expect(t.totals).toMatchObject({ total: "175.00", documents: 3 });
  });

  it("GSTR-1 needs one GSTIN across the branches in scope", async () => {
    const s = service(
      { businessName: async () => ({ legalName: "X", gstin: "32BBBBB0000B1Z5" }) },
      { list: async () => [branch(ids.branchA), branch(ids.branchB, { gstin: "29CCCCC0000C1Z5" })] },
    );
    await expectHttp(s.gstr1Json(authFor("owner"), ids.branchA, reportQuerySchema.parse({ branchId: "all" })), 400);
  });
});

describe("DashboardService", () => {
  it("compares with the previous period and splits receivables older than 30 days", async () => {
    const tz = "Asia/Kolkata";
    const today = todayIn(tz);
    const calls: Date[][] = [];
    const svc = new DashboardService(
      stub<IDashboardRepository>({
        salesTotals: async (_b, start, end) => {
          calls.push([start, end]);
          return calls.length === 1 ? { total: "1500.00", bills: 3 } : { total: "1000.00", bills: 2 };
        },
        collections: async () => [
          { mode: "CASH", amount: "900.00" },
          { mode: "UPI", amount: "300.00" },
        ],
      }),
      stub<IReportRepository>({
        openInvoices: async () => [
          { partyId: "c1", party: "Ravi", mobile: null, dueDate: addDays(today, -45), owed: "200.00" },
          { partyId: "c2", party: "Anu", mobile: null, dueDate: today, owed: "100.00" },
        ],
      }),
      stub<IBranchRepository>({ findById: async (id) => branch(id) }),
      stub<IStockService>({}),
    );
    const s = await svc.summary(authFor("owner"), ids.branchA, { range: "7d" });
    expect(s.from).toBe(addDays(today, -6));
    expect(s.previousTo).toBe(addDays(today, -7));
    expect(calls[0]![0]!.getTime() - calls[1]![0]!.getTime()).toBe(7 * 86_400_000);
    expect(s.sales).toMatchObject({ total: "1500.00", bills: 3, average: "500.00", changePercent: 50 });
    expect(s.collected).toMatchObject({ total: "1200.00", percentOfSales: 80 });
    expect(s.receivables).toEqual({ total: "300.00", customers: 2, overdue30: "200.00", overdueCustomers: 1 });
  });
});
