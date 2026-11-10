import "reflect-metadata";
import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { defaultSettings, type SettingsGroup } from "@automobile/shared";
import { HttpError } from "../common/http-error";
import type { Db } from "../common/prisma-types";
import type { IUnitOfWork } from "../common/unit-of-work";
import { addDays, endOfDayAfter, startOfDayIn } from "../utils/time";
import { env } from "../config/env";
import { authFor, FakeAudit, ids, stub } from "../test/fakes";
import type { IDocumentSequenceService } from "./document-sequences/interfaces/idocument-sequence.service";
import type { IInvoiceRepository } from "./invoices/interfaces/iinvoice.repository";
import type { ICartPricer, IInvoiceService } from "./invoices/interfaces/iinvoice.service";
import { InvoicePostingService } from "./invoices/invoice-posting.service";
import { creditLineAmounts, deriveStatus, roundToRupee } from "./invoices/invoice.rules";
import type {
  CreateInvoiceData,
  CreditableLine,
  CustomerCredit,
  InvoiceDetailDto,
  PricedCartResult,
} from "./invoices/invoice.types";
import type { IHeldCartRepository } from "./pos/interfaces/iheld-cart.repository";
import type { ISettingsService } from "./settings/interfaces/isettings.service";
import type { IShiftService } from "./shifts/interfaces/ishift.service";
import type { IStockService } from "./stock/interfaces/istock.service";
import type { StockMovement } from "./stock/stock.types";
import type { IUserRepository } from "./users/interfaces/iuser.repository";

async function expectHttp(promise: Promise<unknown>, status: number, code?: string) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(HttpError);
  expect((err as HttpError).status).toBe(status);
  if (code) expect((err as HttpError).code).toBe(code);
  return err as HttpError;
}

describe("invoice rules", () => {
  it("derives status from money", () => {
    expect(deriveStatus(10_000, 0, 10_000)).toBe("PAID");
    expect(deriveStatus(10_000, 0, 4_000)).toBe("PARTIALLY_PAID");
    expect(deriveStatus(10_000, 0, 0)).toBe("UNPAID");
    expect(deriveStatus(10_000, 6_000, 4_000)).toBe("PAID");
  });

  const line: CreditableLine = {
    id: "l1",
    kind: "ITEM",
    itemId: "i1",
    description: "Castrol GTX 1L",
    quantity: 3000,
    returned: 0,
    unitCost: 300,
    taxablePaise: 156_000,
    cgstPaise: 14_040,
    sgstPaise: 14_040,
    igstPaise: 0,
    credited: { taxablePaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0 },
  };

  it("credits returns proportionally, and the last units exactly", () => {
    const one = creditLineAmounts(line, 1000);
    expect(one).toMatchObject({ taxablePaise: 52_000, cgstPaise: 4_680, sgstPaise: 4_680 });
    const rest = creditLineAmounts(
      { ...line, returned: 1000, credited: { taxablePaise: 52_000, cgstPaise: 4_680, sgstPaise: 4_680, igstPaise: 0 } },
      2000,
    );
    expect(one.taxablePaise + rest.taxablePaise).toBe(line.taxablePaise);
    expect(one.cgstPaise + rest.cgstPaise).toBe(line.cgstPaise);
  });

  it("rounds credit notes to the rupee", () => {
    expect(roundToRupee(61_360)).toEqual({ totalPaise: 61_400, roundOffPaise: 40 });
    expect(roundToRupee(61_340)).toEqual({ totalPaise: 61_300, roundOffPaise: -40 });
  });

  it("date filters use the business timezone", () => {
    expect(startOfDayIn("2026-11-09", "Asia/Kolkata").toISOString()).toBe("2026-11-08T18:30:00.000Z");
    expect(addDays(startOfDayIn("2026-03-31", "Asia/Kolkata"), 1).toISOString()).toBe("2026-03-31T18:30:00.000Z");
  });
});

// ---------- Posting with fakes ----------

const tx = {} as Db;
const customer: CustomerCredit = {
  id: "50000000-0000-4000-8000-000000000001",
  type: "FLEET",
  name: "Kerala Cabs",
  mobile: "9847012345",
  gstin: null,
  address: null,
  stateCode: null,
  creditLimit: "1000.00",
  creditDays: 15,
  outstanding: "800.00",
  availableCredit: "200.00",
};

function priced(
  totalPaise: number,
  opts: { needsDiscountApproval?: boolean; customer?: CustomerCredit | null } = {},
): PricedCartResult {
  return {
    quote: {
      supplyType: "INTRA_STATE",
      placeOfSupply: "32",
      customer: opts.customer ?? null,
      lines: [],
      itemCount: 1,
      gross: "0",
      lineDiscount: "0",
      billDiscount: "0",
      discount: "0",
      discountPercent: 0,
      taxable: "0",
      cgst: "0",
      sgst: "0",
      igst: "0",
      tax: "0",
      roundOff: "0",
      total: (totalPaise / 100).toFixed(2),
      maxDiscountPercent: 5,
      needsDiscountApproval: opts.needsDiscountApproval ?? false,
      issues: [],
    },
    lines: [
      {
        kind: "ITEM",
        itemId: "40000000-0000-4000-8000-000000000001",
        labourServiceId: null,
        description: "Oil filter",
        sku: "OF-1",
        hsnSac: "8421",
        unit: "PCS",
        quantity: 2,
        rate: 500,
        taxInclusive: false,
        gstRate: 18,
        unitCost: 300,
        lineDiscountPaise: 0,
        billDiscountPaise: 0,
        taxablePaise: 100_000,
        cgstPaise: 9_000,
        sgstPaise: 9_000,
        igstPaise: 0,
        totalPaise: 118_000,
        available: 10,
      },
    ],
    totals: {
      grossPaise: 100_000,
      discountPaise: 0,
      discountBasisPoints: 0,
      taxablePaise: 100_000,
      cgstPaise: 9_000,
      sgstPaise: 9_000,
      igstPaise: 0,
      roundOffPaise: 0,
      totalPaise,
    },
    customer: opts.customer ?? null,
    placeOfSupply: "32",
    supplyType: "INTRA_STATE",
  };
}

function posting(opts: { price: PricedCartResult; shift?: string | null; managerPassword?: string }) {
  const created: CreateInvoiceData[] = [];
  const moves: StockMovement[][] = [];
  const keys = new Map<string, { scope: string; requestHash: string; resourceId: string }>();
  const uow: IUnitOfWork = { run: (work) => work(tx) };
  const invoices = stub<IInvoiceRepository>({
    create: async (_db, data) => {
      created.push(data);
      return { id: `inv-${created.length}` };
    },
    createPayment: async () => ({ id: "p" }),
    addOutboxEvent: async () => {},
    findIdempotency: async (userId, key) => keys.get(`${userId}:${key}`) ?? null,
    saveIdempotency: async (_db, d) => {
      keys.set(`${d.userId}:${d.key}`, d);
    },
  });
  const invoiceService = stub<IInvoiceService>({
    getById: async (_auth, id) => ({ id, number: `INV-${id}` }) as InvoiceDetailDto,
  });
  const stock = stub<IStockService>({
    post: async (_db, _actor, m) => {
      moves.push(m);
    },
  });
  const shifts = stub<IShiftService>({ findOpenId: async () => (opts.shift === undefined ? "shift-1" : opts.shift) });
  const sequences = stub<IDocumentSequenceService>({
    next: async () => ({ number: "INV-26-00001", sequence: 1, financialYear: 2026 }),
  });
  const hash = opts.managerPassword ? bcrypt.hashSync(opts.managerPassword, 4) : "x";
  const users = stub<IUserRepository>({
    findCredentialsByEmail: async (email) =>
      email === "manager@x.in" ? { id: ids.manager, status: "ACTIVE", passwordHash: hash } : null,
    findAuthUser: async () => ({
      id: ids.manager,
      status: "ACTIVE",
      role: { id: ids.managerRole, key: "BRANCH_MANAGER", permissions: ["discount.override", "credit.override"] },
      branchIds: [ids.branchA],
    }),
  });
  const settings = stub<ISettingsService>({ get: async (g: SettingsGroup) => defaultSettings(g) as never });
  const svc = new InvoicePostingService(
    uow,
    stub<ICartPricer>({ price: async () => opts.price }),
    invoices,
    invoiceService,
    stock,
    shifts,
    sequences,
    stub<IHeldCartRepository>({ softDelete: async () => true }),
    users,
    settings,
    new FakeAudit(),
  );
  return { svc, created, moves };
}

const item = { kind: "ITEM" as const, itemId: "40000000-0000-4000-8000-000000000001", quantity: 2, discount: 0 };
const cash = (amount: number) => [{ mode: "CASH" as const, amount }];

describe("InvoicePostingService", () => {
  const counter = authFor("counter");

  it("needs an open shift", async () => {
    const { svc } = posting({ price: priced(118_000), shift: null });
    await expectHttp(svc.charge(counter, ids.branchA, { lines: [item], payments: cash(1180) }), 409);
  });

  it("posts a paid invoice and moves stock out", async () => {
    const { svc, created, moves } = posting({ price: priced(118_000) });
    await svc.charge(counter, ids.branchA, { lines: [item], payments: cash(1180) });
    expect(created[0]).toMatchObject({
      status: "PAID",
      grandTotal: "1180.00",
      paidTotal: "1180.00",
      shiftId: "shift-1",
      dueDate: null,
    });
    expect(moves[0]).toEqual([expect.objectContaining({ type: "SALE", quantity: -2, refNo: "INV-26-00001" })]);
  });

  it("refuses part payment for walk-ins", async () => {
    const { svc } = posting({ price: priced(118_000) });
    await expectHttp(svc.charge(counter, ids.branchA, { lines: [item], payments: cash(100) }), 400);
  });

  it("refuses a total that changed since the cashier saw it", async () => {
    const { svc } = posting({ price: priced(118_000) });
    await expectHttp(svc.charge(counter, ids.branchA, { lines: [item], payments: [], expectedTotal: 1000 }), 409);
  });

  it("asks for a manager when the discount is above the limit, and accepts a valid override", async () => {
    const { svc, created } = posting({
      price: priced(118_000, { needsDiscountApproval: true }),
      managerPassword: "secret-1",
    });
    const body = { lines: [item], payments: cash(1180) };
    const err = await expectHttp(svc.charge(counter, ids.branchA, body), 403, "APPROVAL_REQUIRED");
    expect(err.details).toEqual({ approvals: ["discount"] });
    await expectHttp(
      svc.charge(counter, ids.branchA, { ...body, override: { email: "manager@x.in", password: "wrong" } }),
      403,
    );
    await svc.charge(counter, ids.branchA, { ...body, override: { email: "manager@x.in", password: "secret-1" } });
    expect(created[0]!.discountApprovedById).toBe(ids.manager);
  });

  it("asks for credit approval beyond the customer's limit (₹800 owed + ₹1,180 > ₹1,000)", async () => {
    const { svc } = posting({ price: priced(118_000, { customer }) });
    const err = await expectHttp(
      svc.charge(counter, ids.branchA, { customerId: customer.id, lines: [item], payments: [] }),
      403,
    );
    expect(err.details).toEqual({ approvals: ["credit"] });
  });

  it("a manager sells on credit directly, with a due date from the customer's credit days", async () => {
    const { svc, created } = posting({ price: priced(118_000, { customer }) });
    await svc.charge(authFor("manager"), ids.branchA, { customerId: customer.id, lines: [item], payments: [] });
    expect(created[0]!.status).toBe("UNPAID");
    // Due at the end of the 15th day (business timezone), so it is not overdue until that day is over.
    expect(created[0]!.dueDate).toEqual(endOfDayAfter(new Date(), 15, env.APP_TIMEZONE));
  });

  it("replays a retry with the same idempotency key and rejects a different body", async () => {
    const { svc, created } = posting({ price: priced(118_000) });
    const body = { lines: [item], payments: cash(1180) };
    const first = await svc.charge(counter, ids.branchA, body, "key-12345678");
    const again = await svc.charge(counter, ids.branchA, body, "key-12345678");
    expect(again).toEqual({ invoice: first.invoice, replayed: true });
    expect(created).toHaveLength(1);
    await expectHttp(svc.charge(counter, ids.branchA, { ...body, notes: "changed" }, "key-12345678"), 409);
  });
});

describe("endOfDayAfter", () => {
  it("is the last instant of the business day, so a 0-credit-day bill isn't overdue on the same day", () => {
    expect(endOfDayAfter(new Date("2026-11-10T10:00:00Z"), 0, "Asia/Kolkata").toISOString()).toBe(
      "2026-11-10T18:29:59.999Z",
    );
    // 20:00 UTC is already 11 Nov in India.
    expect(endOfDayAfter(new Date("2026-11-10T20:00:00Z"), 15, "Asia/Kolkata").toISOString()).toBe(
      "2026-11-26T18:29:59.999Z",
    );
  });
});
