import { z } from "zod";
import { loginIdentifierSchema, optionalText, requiredText } from "./common.js";
import { moneySchema, positiveQuantitySchema } from "./inventory.js";

// ---------- Payments ----------

// How money actually moves. "Credit" at the POS is not a payment: it is the unpaid balance.
export const PAYMENT_METHODS = ["CASH", "UPI", "CARD", "BANK_TRANSFER", "CHEQUE"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  CHEQUE: "Cheque",
};

// Counter payments at the POS (bank transfer / cheque are recorded later against the invoice).
export const POS_PAYMENT_METHODS = ["CASH", "UPI", "CARD"] as const satisfies readonly PaymentMethod[];

const positiveMoney = moneySchema.refine((v) => v > 0, "Must be more than 0");

export const paymentInputSchema = z
  .strictObject({
    mode: z.enum(PAYMENT_METHODS),
    amount: positiveMoney,
    // Cash handed over; change = tendered − amount.
    tendered: moneySchema.nullable().optional(),
    reference: optionalText(60),
  })
  .superRefine((p, ctx) => {
    if (p.tendered != null && p.mode !== "CASH")
      ctx.addIssue({ code: "custom", path: ["tendered"], message: "Only for cash" });
    if (p.tendered != null && p.tendered < p.amount)
      ctx.addIssue({ code: "custom", path: ["tendered"], message: "Cash received is less than the amount" });
  });
export type PaymentInput = z.output<typeof paymentInputSchema>;

export const paymentCreateSchema = z.strictObject({
  mode: z.enum(PAYMENT_METHODS),
  amount: positiveMoney,
  reference: optionalText(60),
  note: optionalText(200),
});
export type PaymentCreate = z.output<typeof paymentCreateSchema>;

export const paymentReverseSchema = z.strictObject({ reason: requiredText(200) });

// ---------- Cart / invoice ----------

export const BILL_DISCOUNT_TYPES = ["AMOUNT", "PERCENT"] as const;

export const billDiscountSchema = z
  .strictObject({
    type: z.enum(BILL_DISCOUNT_TYPES),
    value: moneySchema,
  })
  .refine((d) => d.type !== "PERCENT" || d.value <= 100, { message: "At most 100%", path: ["value"] });

const lineDiscount = moneySchema.default(0);

export const cartLineSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("ITEM"),
    itemId: z.uuid(),
    quantity: positiveQuantitySchema,
    discount: lineDiscount,
  }),
  z.strictObject({
    kind: z.literal("LABOUR"),
    labourServiceId: z.uuid(),
    quantity: positiveQuantitySchema,
    discount: lineDiscount,
  }),
]);
export type CartLine = z.output<typeof cartLineSchema>;

const cartLines = z.array(cartLineSchema).min(1, "Add at least one item").max(200);

// A manager authorising a discount or credit above the cashier's limit, at the counter.
export const managerOverrideSchema = z.strictObject({
  // The manager's mobile number or email.
  identifier: loginIdentifierSchema,
  password: z.string().min(1, "Enter the manager's password").max(72),
});
export type ManagerOverride = z.output<typeof managerOverrideSchema>;

export const quoteSchema = z.strictObject({
  customerId: z.uuid().nullable().optional(),
  lines: cartLines,
  billDiscount: billDiscountSchema.nullable().optional(),
});
export type QuoteInput = z.output<typeof quoteSchema>;

export const invoiceCreateSchema = z.strictObject({
  customerId: z.uuid().nullable().optional(),
  lines: cartLines,
  billDiscount: billDiscountSchema.nullable().optional(),
  payments: z.array(paymentInputSchema).max(5).default([]),
  notes: optionalText(300),
  // The total the cashier saw; the charge is refused (409) if server prices differ.
  expectedTotal: moneySchema.optional(),
  heldCartId: z.uuid().optional(),
  override: managerOverrideSchema.optional(),
});
export type InvoiceCreate = z.output<typeof invoiceCreateSchema>;

export const invoiceCancelSchema = z.strictObject({ reason: requiredText(200) });

// ---------- Old dues (opening balance) ----------

// What a customer already owed before the shop started using this software. Saved as an
// "Old dues" bill (kind OPENING_BALANCE): it counts in dues and can be collected like any bill,
// but it is not a sale, so it never appears in sales, GST or Tally sales.
export const INVOICE_KINDS = ["SALE", "OPENING_BALANCE"] as const;
export type InvoiceKind = (typeof INVOICE_KINDS)[number];
export const INVOICE_KIND_LABELS: Record<InvoiceKind, string> = { SALE: "Tax invoice", OPENING_BALANCE: "Old dues" };

export const openingBalanceCreateSchema = z.strictObject({
  customerId: z.uuid(),
  amount: positiveMoney,
  // The day the dues are counted from (usually the go-live day); not in the future.
  asOfDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .refine((d) => !Number.isNaN(Date.parse(d)), "Not a valid date"),
  note: optionalText(300),
});
export type OpeningBalanceCreate = z.output<typeof openingBalanceCreateSchema>;

export const INVOICE_STATUSES = ["PAID", "PARTIALLY_PAID", "UNPAID", "OVERDUE", "CANCELLED"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  PAID: "Paid",
  PARTIALLY_PAID: "Partly paid",
  UNPAID: "Unpaid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

// ---------- Credit notes ----------

export const creditNoteCreateSchema = z.strictObject({
  invoiceId: z.uuid(),
  reason: requiredText(200),
  lines: z
    .array(z.strictObject({ invoiceLineId: z.uuid(), quantity: positiveQuantitySchema }))
    .min(1, "Choose at least one line")
    .max(200)
    .refine((ls) => new Set(ls.map((l) => l.invoiceLineId)).size === ls.length, "Each line can appear only once"),
  // How money is returned when the customer has paid more than the reduced total.
  refundMode: z.enum(PAYMENT_METHODS).default("CASH"),
});
export type CreditNoteCreate = z.output<typeof creditNoteCreateSchema>;

// ---------- Shifts ----------

export const shiftOpenSchema = z.strictObject({
  counter: requiredText(30).default("Counter 1"),
  openingCash: moneySchema.default(0),
});
export type ShiftOpen = z.output<typeof shiftOpenSchema>;

export const shiftCloseSchema = z.strictObject({
  // Counted per method at close; methods not counted are taken as 0.
  counted: z.partialRecord(z.enum(PAYMENT_METHODS), moneySchema).default({}),
  note: optionalText(300),
});
export type ShiftClose = z.output<typeof shiftCloseSchema>;

// ---------- Held carts ----------

export const heldCartCreateSchema = z.strictObject({
  label: optionalText(60),
  customerId: z.uuid().nullable().optional(),
  lines: cartLines,
  billDiscount: billDiscountSchema.nullable().optional(),
});
export type HeldCartCreate = z.output<typeof heldCartCreateSchema>;

// ---------- Phone scanner ----------

// A barcode read by a paired phone (same limits as the item barcode lookup).
export const scanEventCreateSchema = z.strictObject({
  code: z.string().trim().min(1, "Barcode is required").max(64),
});
export type ScanEventCreate = z.output<typeof scanEventCreateSchema>;

// The PC polls for scans after the last id it has seen (ids are sent as strings: they are bigints).
export const scanPollQuerySchema = z.object({
  after: z
    .string()
    .regex(/^\d{1,19}$/, "Must be a scan id")
    .optional(),
});
export type ScanPollQuery = z.output<typeof scanPollQuerySchema>;
