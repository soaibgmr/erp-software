import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { openingBalanceCreateSchema } from "@automobile/shared";
import { HttpError } from "../common/http-error";
import type { Db } from "../common/prisma-types";
import type { IUnitOfWork } from "../common/unit-of-work";
import { env } from "../config/env";
import { endOfDayAfter, startOfDayIn } from "../utils/time";
import { authFor, branch, FakeAudit, ids, stub } from "../test/fakes";
import type { IBranchRepository } from "./branches/interfaces/ibranch.repository";
import type { ICustomerRepository } from "./customers/interfaces/icustomer.repository";
import type { CustomerResponseDto } from "./customers/customer.types";
import type { IDocumentSequenceService } from "./document-sequences/interfaces/idocument-sequence.service";
import type { IInvoiceRepository } from "./invoices/interfaces/iinvoice.repository";
import type { IInvoiceService } from "./invoices/interfaces/iinvoice.service";
import { CreditNoteService } from "./invoices/credit-note.service";
import { InvoiceService } from "./invoices/invoice.service";
import { OpeningBalanceService } from "./invoices/opening-balance.service";
import type { CreateInvoiceData, InvoiceDetailDto } from "./invoices/invoice.types";
import { todayIn } from "../common/date-only";
import type { IShiftService } from "./shifts/interfaces/ishift.service";
import type { IStockService } from "./stock/interfaces/istock.service";
import type { IBusinessRepository } from "./business/interfaces/ibusiness.repository";

const tx = {} as Db;
const uow: IUnitOfWork = { run: (work) => work(tx) };
const customerId = "50000000-0000-4000-8000-000000000009";
const ramesh = {
  id: customerId,
  name: "Ramesh Auto Works",
  mobile: "9847000001",
  gstin: null,
  address: "MG Road",
  stateCode: null,
  creditDays: 30,
} as unknown as CustomerResponseDto;

function service(opts: { customer?: CustomerResponseDto | null } = {}) {
  const created: CreateInvoiceData[] = [];
  const audit = new FakeAudit();
  const series: string[] = [];
  const svc = new OpeningBalanceService(
    uow,
    stub<IInvoiceRepository>({
      create: async (_db, data) => {
        created.push(data);
        return { id: "ob-1" };
      },
    }),
    stub<IInvoiceService>({ getById: async (_a, id) => ({ id, number: "OB-26-00001" }) as InvoiceDetailDto }),
    stub<ICustomerRepository>({ findById: async () => (opts.customer === undefined ? ramesh : opts.customer) }),
    stub<IBranchRepository>({ findById: async (id) => branch(id) }),
    stub<IDocumentSequenceService>({
      next: async (_db, _b, type) => {
        series.push(type);
        return { number: "OB-26-00001", sequence: 1, financialYear: 2026 };
      },
    }),
    audit,
  );
  return { svc, created, audit, series };
}

const errorOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e as HttpError;
  }
  throw new Error("expected an error");
};

describe("openingBalanceCreateSchema", () => {
  it("needs a customer, an amount above 0 and a YYYY-MM-DD date", () => {
    expect(openingBalanceCreateSchema.safeParse({ customerId, amount: 12000, asOfDate: "2026-11-01" }).success).toBe(
      true,
    );
    expect(openingBalanceCreateSchema.safeParse({ customerId, amount: 0, asOfDate: "2026-11-01" }).success).toBe(false);
    expect(openingBalanceCreateSchema.safeParse({ customerId, amount: 10.005, asOfDate: "2026-11-01" }).success).toBe(
      false,
    );
    expect(openingBalanceCreateSchema.safeParse({ customerId, amount: 100, asOfDate: "01-11-2026" }).success).toBe(
      false,
    );
    expect(openingBalanceCreateSchema.safeParse({ customerId, amount: 100, asOfDate: "2026-13-45" }).success).toBe(
      false,
    );
  });
});

describe("OpeningBalanceService", () => {
  it("saves old dues as an unpaid OPENING_BALANCE bill with no lines or tax, numbered from the OB series", async () => {
    const { svc, created, audit, series } = service();
    await svc.create(authFor("manager"), ids.branchA, {
      customerId,
      amount: 12000,
      asOfDate: "2026-11-01",
      note: "From ledger book",
    });

    expect(series).toEqual(["OPENING_BALANCE"]);
    const d = created[0]!;
    expect(d.kind).toBe("OPENING_BALANCE");
    expect(d.status).toBe("UNPAID");
    expect(d.grandTotal).toBe("12000.00");
    expect(d.paidTotal).toBe("0.00");
    expect([d.taxableTotal, d.cgstTotal, d.sgstTotal, d.igstTotal]).toEqual(["0.00", "0.00", "0.00", "0.00"]);
    expect(d.lines).toEqual([]);
    expect(d.shiftId).toBeNull();
    expect(d.customerName).toBe("Ramesh Auto Works");
    expect(d.notes).toBe("From ledger book");
    // Dated the day it is counted from, due after the customer's 30 days to clear dues.
    expect(d.invoiceDate).toEqual(startOfDayIn("2026-11-01", env.APP_TIMEZONE));
    expect(d.dueDate).toEqual(endOfDayAfter(startOfDayIn("2026-11-01", env.APP_TIMEZONE), 30, env.APP_TIMEZONE));
    expect(audit.entries[0]).toMatchObject({ action: "customer.opening_balance", entity: "Invoice", entityId: "ob-1" });
  });

  it("refuses a future date, an unknown customer and another branch", async () => {
    const { svc } = service();
    const tomorrow = new Date(Date.parse(`${todayIn(env.APP_TIMEZONE)}T00:00:00Z`) + 86_400_000)
      .toISOString()
      .slice(0, 10);
    const future = await errorOf(
      svc.create(authFor("manager"), ids.branchA, { customerId, amount: 100, asOfDate: tomorrow }),
    );
    expect(future.status).toBe(400);
    expect(JSON.stringify(future.details)).toContain("future");

    const missing = await errorOf(
      service({ customer: null }).svc.create(authFor("manager"), ids.branchA, {
        customerId,
        amount: 100,
        asOfDate: "2026-11-01",
      }),
    );
    expect(missing.status).toBe(400);

    const other = await errorOf(
      svc.create(authFor("manager"), ids.branchB, { customerId, amount: 100, asOfDate: "2026-11-01" }),
    );
    expect(other.status).toBe(403);
  });
});

// ---------- Old dues are not a sale: no print, no credit note, no "refund" on cancel ----------

const oldDues = (paidTotal: string) =>
  ({
    id: "ob-1",
    number: "OB-26-00001",
    kind: "OPENING_BALANCE",
    status: Number(paidTotal) > 0 ? "PARTIALLY_PAID" : "UNPAID",
    branch: { id: ids.branchA, code: "A", name: "A" },
    grandTotal: "12000.00",
    paidTotal,
    lines: [],
    creditNotes: [],
  }) as unknown as InvoiceDetailDto;

function invoiceService(detail: InvoiceDetailDto) {
  const cancelled: string[] = [];
  const svc = new InvoiceService(
    uow,
    stub<IInvoiceRepository>({
      findDetail: async () => detail,
      lockInvoice: async () => ({
        id: detail.id,
        number: detail.number,
        branchId: ids.branchA,
        customerId,
        status: "UNPAID",
        grandTotal: 1_200_000,
        paidTotal: 0,
        creditedTotal: 0,
        supplyType: "INTRA_STATE",
      }),
      paymentsByMode: async () => [],
      markCancelled: async (_db, id) => {
        cancelled.push(id);
      },
      updateTotals: async () => {},
      addOutboxEvent: async () => {},
    }),
    stub<IStockService>({ post: async () => {} }),
    stub<IShiftService>({ findOpenId: async () => null }),
    stub<IBranchRepository>({}),
    stub<IBusinessRepository>({}),
    new FakeAudit(),
  );
  return { svc, cancelled };
}

describe("old dues guards", () => {
  it("has nothing to print", async () => {
    const e = await errorOf(invoiceService(oldDues("0.00")).svc.print(authFor("manager"), "ob-1"));
    expect(e.status).toBe(400);
  });

  it("cancels unpaid old dues, but not once money was collected", async () => {
    const unpaid = invoiceService(oldDues("0.00"));
    await unpaid.svc.cancel(authFor("manager"), "ob-1", "Entered twice");
    expect(unpaid.cancelled).toEqual(["ob-1"]);

    const e = await errorOf(invoiceService(oldDues("2000.00")).svc.cancel(authFor("manager"), "ob-1", "Wrong"));
    expect(e.status).toBe(409);
    expect(e.message).toContain("reverse them");
  });

  it("refuses a credit note", async () => {
    const svc = new CreditNoteService(
      uow,
      stub<IInvoiceRepository>({}),
      stub<IInvoiceService>({ getById: async () => oldDues("0.00") }),
      stub<IStockService>({}),
      stub<IShiftService>({}),
      stub<IDocumentSequenceService>({}),
      stub<IBranchRepository>({}),
      new FakeAudit(),
    );
    const e = await errorOf(
      svc.create(authFor("manager"), {
        invoiceId: "ob-1",
        reason: "Return",
        lines: [{ invoiceLineId: "00000000-0000-4000-8000-0000000000aa", quantity: 1 }],
      } as never),
    );
    expect(e.status).toBe(409);
  });
});
