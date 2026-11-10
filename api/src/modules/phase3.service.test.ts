import "reflect-metadata";
import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { defaultSettings, placeOfSupplyFor, type SettingsGroup } from "@erp-software/shared";
import { HttpError } from "../common/http-error";
import type { Db } from "../common/prisma-types";
import type { IUnitOfWork } from "../common/unit-of-work";
import { addDays, endOfDayAfter, startOfDayIn } from "../utils/time";
import { env } from "../config/env";
import { authFor, FakeAudit, FakeLimiter, ids, stub } from "../test/fakes";
import type { IDocumentSequenceService } from "./document-sequences/interfaces/idocument-sequence.service";
import type { IInvoiceRepository } from "./invoices/interfaces/iinvoice.repository";
import type { ICartPricer, IInvoiceMailer, IInvoiceService } from "./invoices/interfaces/iinvoice.service";
import { invoiceMail } from "./mail/mail.templates";
import { InvoicePostingService } from "./invoices/invoice-posting.service";
import { InvoiceService } from "./invoices/invoice.service";
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
  it("place of supply: GSTIN state for registered buyers, the branch's state for counter sales", () => {
    expect(placeOfSupplyFor("32", "29ABCDE1234F1Z5")).toBe("29");
    // A walk-in whose address is in Karnataka still pays CGST + SGST at a Kerala counter.
    expect(placeOfSupplyFor("32", null)).toBe("32");
    expect(placeOfSupplyFor("32")).toBe("32");
  });

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
  email: null,
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
      // Every bill has a customer now; pass `customer: null` to test the refusal.
      customer: opts.customer === undefined ? customer : opts.customer,
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
    customer: opts.customer === undefined ? customer : opts.customer,
    placeOfSupply: "32",
    supplyType: "INTRA_STATE",
  };
}

function posting(opts: { price: PricedCartResult; shift?: string | null; managerPassword?: string }) {
  const limiter = new FakeLimiter();
  const emailed: { invoiceId: string; to: string }[] = [];
  const mailer = stub<IInvoiceMailer>({
    emailInBackground: (_auth, invoiceId, to) => {
      emailed.push({ invoiceId, to });
    },
  });
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
    findCredentialsByIdentifier: async (identifier) =>
      identifier === "9800000001"
        ? { id: ids.manager, status: "ACTIVE", passwordHash: hash, businessId: ids.business, businessStatus: "ACTIVE" }
        : null,
    findAuthUser: async () => ({
      id: ids.manager,
      status: "ACTIVE",
      businessId: ids.business,
      businessStatus: "ACTIVE",
      role: { id: ids.managerRole, key: "BRANCH_MANAGER", permissions: ["discount.override", "credit.override"] },
      branchIds: [ids.branchA],
    }),
  });
  const settings = stub<ISettingsService>({
    get: async (_businessId: string, g: SettingsGroup) => defaultSettings(g) as never,
  });
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
    mailer,
    limiter,
  );
  return { svc, created, moves, emailed, limiter };
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

  it("refuses a bill without a customer (no walk-in billing)", async () => {
    const { svc } = posting({ price: priced(118_000, { customer: null }) });
    const err = await expectHttp(svc.charge(counter, ids.branchA, { lines: [item], payments: cash(1180) }), 400);
    expect((err.details as { fieldErrors: Record<string, string[]> }).fieldErrors.customerId).toBeDefined();
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
      svc.charge(counter, ids.branchA, { ...body, override: { identifier: "9800000001", password: "wrong" } }),
      403,
    );
    await svc.charge(counter, ids.branchA, { ...body, override: { identifier: "9800000001", password: "secret-1" } });
    expect(created[0]!.discountApprovedById).toBe(ids.manager);
  });

  it("locks the manager override after repeated wrong passwords", async () => {
    const { svc } = posting({ price: priced(118_000, { needsDiscountApproval: true }), managerPassword: "secret-1" });
    const body = { lines: [item], payments: cash(1180) };
    for (let i = 0; i < 8; i++) {
      await expectHttp(
        svc.charge(counter, ids.branchA, { ...body, override: { identifier: "9800000001", password: `guess-${i}` } }),
        403,
      );
    }
    // Even the right password is refused while locked.
    await expectHttp(
      svc.charge(counter, ids.branchA, { ...body, override: { identifier: "9800000001", password: "secret-1" } }),
      429,
    );
  });

  it("asks for credit approval beyond the customer's limit (₹800 owed + ₹1,180 > ₹1,000)", async () => {
    const { svc } = posting({ price: priced(118_000, { customer }) });
    const err = await expectHttp(
      svc.charge(counter, ids.branchA, { customerId: customer.id, lines: [item], payments: [] }),
      403,
    );
    expect(err.details).toEqual({ approvals: ["credit"] });
  });

  it("emails the bill when the customer has an email, and not otherwise", async () => {
    const withEmail = { ...customer, email: "accounts@keralacabs.in" };
    const a = posting({ price: priced(118_000, { customer: withEmail }) });
    await a.svc.charge(counter, ids.branchA, { customerId: customer.id, lines: [item], payments: cash(1180) });
    expect(a.emailed).toEqual([{ invoiceId: expect.any(String), to: "accounts@keralacabs.in" }]);

    const b = posting({ price: priced(118_000, { customer }) });
    await b.svc.charge(counter, ids.branchA, { customerId: customer.id, lines: [item], payments: cash(1180) });
    expect(b.emailed).toEqual([]);
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

describe("Bill email", () => {
  const input = {
    business: {
      name: "Noor <Auto> Parts",
      gstin: "32ABCDE1234F1Z5",
      address: "MG Road, Kochi",
      phone: "9847000000",
      email: null,
    },
    invoice: {
      number: "INV-26-00007",
      date: new Date("2026-11-10T06:00:00Z"),
      dueDate: new Date("2026-11-25T18:29:59Z"),
      customerName: "Kerala Cabs",
      customerGstin: null,
      lines: [
        { description: "Oil filter", quantity: "2.000", unit: "PCS", rate: "500.00", gstRate: 18, total: "1180.00" },
      ],
      discountTotal: "0.00",
      taxableTotal: "1000.00",
      cgstTotal: "90.00",
      sgstTotal: "90.00",
      igstTotal: "0.00",
      roundOff: "0.00",
      grandTotal: "1180.00",
      paidTotal: "180.00",
      balanceDue: "1000.00",
      amountInWords: "Rupees One Thousand One Hundred Eighty Only",
    },
  };

  it("shows the bill with GST split, dues and the shop's name, escaped", () => {
    const mail = invoiceMail(input);
    expect(mail.subject).toBe("Your bill INV-26-00007 from Noor <Auto> Parts");
    expect(mail.html).toContain("Noor &lt;Auto&gt; Parts");
    expect(mail.html).not.toContain("<Auto>");
    expect(mail.html).toContain("CGST");
    expect(mail.html).not.toContain("IGST");
    expect(mail.html).toContain("Pay later (dues)");
    expect(mail.text).toContain("Oil filter");
    expect(mail.text).toContain("Total: ₹1,180.00");
  });
});

describe("InvoiceService.cancel", () => {
  const detail = {
    id: "inv-1",
    number: "INV-26-00001",
    status: "PAID",
    kind: "SALE",
    paidTotal: "1180.00",
    creditNotes: [],
    branch: { id: ids.branchA },
    lines: [{ kind: "ITEM", itemId: "item-1", quantity: "2.000", returnedQty: "0.000" }],
  } as unknown as InvoiceDetailDto;

  it("refuses when a credit note was saved after the first read (no double restock)", async () => {
    const moves: StockMovement[][] = [];
    const uow: IUnitOfWork = { run: (work) => work({} as Db) };
    const svc = new InvoiceService(
      uow,
      stub<IInvoiceRepository>({
        findDetail: async () => detail,
        lockInvoice: async () => ({
          id: "inv-1",
          number: "INV-26-00001",
          branchId: ids.branchA,
          customerId: null,
          status: "PARTIALLY_RETURNED" as never,
          grandTotal: 118_000,
          paidTotal: 118_000,
          creditedTotal: 59_000,
          supplyType: "INTRA_STATE",
        }),
      }),
      stub<IStockService>({
        post: async (_db, _actor, m) => {
          moves.push(m);
        },
      }),
      stub<IShiftService>({ findOpenId: async () => "shift-1" }),
      stub({}),
      stub({}),
      new FakeAudit(),
    );
    await expectHttp(svc.cancel(authFor("manager"), "inv-1", "wrong bill"), 409);
    expect(moves).toEqual([]);
  });
});
