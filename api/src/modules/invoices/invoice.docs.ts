import {
  heldCartCreateSchema,
  INVOICE_STATUSES,
  PAYMENT_METHODS,
  quoteSchema,
  shiftCloseSchema,
  shiftOpenSchema,
} from "@automobile/shared";
import {
  fromZod,
  operation,
  pathParam,
  type Paths,
  queryParams,
  ref,
  type SchemaObject,
  success,
} from "../../docs/openapi.helpers";
import { listShiftsQuerySchema } from "../shifts/shift.schema";
import {
  cancelInvoiceSchema,
  createCreditNoteSchema,
  createInvoiceSchema,
  createOpeningBalanceSchema,
  createPaymentSchema,
  listCreditNotesQuerySchema,
  listInvoicesQuerySchema,
  reversePaymentSchema,
} from "./invoice.schema";

const str = { type: "string" };
const s = { type: ["string", "null"] };
const money = (example: string) => ({ type: "string", example });
const userRef = { type: ["object", "null"], properties: { id: str, name: str } };
const date = { type: "string", format: "date-time" };

export const salesSchemas: Record<string, SchemaObject> = {
  Quote: {
    type: "object",
    description: "Server-side cart totals. Money is a 2-decimal string.",
    properties: {
      supplyType: { type: "string", enum: ["INTRA_STATE", "INTER_STATE"] },
      placeOfSupply: { type: "string", example: "32" },
      customer: { oneOf: [ref("CustomerCredit"), { type: "null" }] },
      lines: { type: "array", items: { type: "object" } },
      gross: money("5475.00"),
      discount: money("0.00"),
      discountPercent: { type: "number" },
      taxable: money("5475.00"),
      cgst: money("492.75"),
      sgst: money("492.75"),
      igst: money("0.00"),
      roundOff: money("0.50"),
      total: money("6461.00"),
      maxDiscountPercent: { type: "number" },
      needsDiscountApproval: { type: "boolean" },
      issues: { type: "array", items: { type: "object", properties: { line: { type: "integer" }, message: str } } },
    },
  },
  CustomerCredit: {
    type: "object",
    properties: {
      id: str,
      name: str,
      mobile: str,
      gstin: s,
      creditLimit: money("50000.00"),
      creditDays: { type: "integer" },
      outstanding: money("12500.00"),
      availableCredit: money("37500.00"),
    },
  },
  InvoiceSummary: {
    type: "object",
    properties: {
      id: str,
      number: { type: "string", example: "INV-26-01874" },
      kind: {
        type: "string",
        enum: ["SALE", "OPENING_BALANCE"],
        description: "OPENING_BALANCE = a customer's old dues",
      },
      branch: { type: "object", properties: { id: str, code: str, name: str } },
      invoiceDate: date,
      dueDate: { type: ["string", "null"], format: "date-time" },
      status: { type: "string", enum: [...INVOICE_STATUSES] },
      customerId: s,
      customerName: s,
      customerMobile: s,
      itemCount: { type: "integer" },
      grandTotal: money("4814.00"),
      paidTotal: money("4814.00"),
      creditedTotal: money("0.00"),
      balanceDue: money("0.00"),
      paymentModes: { type: "array", items: { type: "string", enum: [...PAYMENT_METHODS] } },
    },
  },
  Payment: {
    type: "object",
    properties: {
      id: str,
      mode: { type: "string", enum: [...PAYMENT_METHODS] },
      amount: { type: "string", description: "Negative for reversals and refunds." },
      tendered: s,
      reference: s,
      note: s,
      kind: { type: "string", enum: ["RECEIPT", "REVERSAL", "REFUND"] },
      reversesPaymentId: s,
      reversed: { type: "boolean" },
      receivedAt: date,
      createdBy: userRef,
    },
  },
  InvoiceDetail: {
    allOf: [
      ref("InvoiceSummary"),
      {
        type: "object",
        properties: {
          customerGstin: s,
          placeOfSupply: str,
          supplyType: str,
          grossTotal: str,
          discountTotal: str,
          taxableTotal: str,
          cgstTotal: str,
          sgstTotal: str,
          igstTotal: str,
          roundOff: str,
          lines: { type: "array", items: { type: "object" } },
          payments: { type: "array", items: ref("Payment") },
          creditNotes: { type: "array", items: { type: "object" } },
          cancelledAt: { type: ["string", "null"], format: "date-time" },
          cancelReason: s,
          discountApprovedBy: userRef,
          creditApprovedBy: userRef,
        },
      },
    ],
  },
  InvoicePrint: {
    type: "object",
    properties: {
      invoice: ref("InvoiceDetail"),
      business: { type: "object" },
      branch: { type: "object" },
      amountInWords: { type: "string", example: "Indian Rupees Four Thousand Eight Hundred Fourteen Only" },
      taxSummary: { type: "array", items: { type: "object" } },
    },
  },
  CreditNote: {
    type: "object",
    properties: {
      id: str,
      number: { type: "string", example: "CN-26-00004" },
      invoice: { type: "object", properties: { id: str, number: str, customerName: s } },
      reason: str,
      total: str,
      refunded: str,
      lines: { type: "array", items: { type: "object" } },
      createdAt: date,
    },
  },
  ShiftReport: {
    type: "object",
    properties: {
      id: str,
      counter: { type: "string", example: "Counter 1" },
      status: { type: "string", enum: ["OPEN", "CLOSED"] },
      openingCash: str,
      openedAt: date,
      closedAt: { type: ["string", "null"], format: "date-time" },
      user: userRef,
      methods: {
        type: "array",
        items: { type: "object", properties: { mode: str, expected: str, counted: s, variance: s } },
      },
      invoiceCount: { type: "integer" },
      salesTotal: str,
      cancelledCount: { type: "integer" },
      creditTotal: str,
    },
  },
  HeldCart: {
    type: "object",
    properties: {
      id: str,
      label: s,
      customerName: s,
      lineCount: { type: "integer" },
      total: str,
      cart: { type: "object" },
      createdAt: date,
    },
  },
};

const branch = "Acts on the `x-branch-id` branch.";

export const salesPaths: Paths = {
  "/api/v1/shifts/current": {
    get: operation({
      tag: "Shifts",
      summary: "Your open shift in the branch",
      description: `${branch} \`data: null\` when you have no open shift.`,
      responses: { 200: success("Shift or null", { oneOf: [ref("ShiftReport"), { type: "null" }] }) },
    }),
  },
  "/api/v1/shifts": {
    get: operation({
      tag: "Shifts",
      summary: "List shifts",
      description: `${branch} Cashiers see their own; \`report.view\` sees all.`,
      parameters: queryParams(listShiftsQuerySchema),
      responses: { 200: success("Shifts", { type: "array", items: ref("ShiftReport") }, { paginated: true }) },
    }),
  },
  "/api/v1/shifts/open": {
    post: operation({
      tag: "Shifts",
      summary: "Open a shift",
      description: `Requires \`pos.use\`. ${branch} One open shift per user and branch (409).`,
      body: fromZod(shiftOpenSchema),
      responses: { 201: success("Shift", ref("ShiftReport")) },
    }),
  },
  "/api/v1/shifts/{id}/close": {
    post: operation({
      tag: "Shifts",
      summary: "Close a shift with counted amounts",
      description: "Stores counted vs expected per payment method; the variance is audited.",
      parameters: [pathParam("id")],
      body: fromZod(shiftCloseSchema),
      responses: { 200: success("Shift report", ref("ShiftReport")) },
    }),
  },
  "/api/v1/shifts/{id}/report": {
    get: operation({
      tag: "Shifts",
      summary: "Shift report",
      parameters: [pathParam("id")],
      responses: { 200: success("Report", ref("ShiftReport")) },
    }),
  },
  "/api/v1/pos/quote": {
    post: operation({
      tag: "POS",
      summary: "Price a cart",
      description: `${branch} Same engine as the charge: line discounts, bill discount apportioned by line, GST per line, rupee round-off.`,
      body: fromZod(quoteSchema),
      responses: { 200: success("Quote", ref("Quote")) },
    }),
  },
  "/api/v1/pos/held-carts": {
    get: operation({
      tag: "POS",
      summary: "Held carts in the branch",
      responses: { 200: success("Held carts", { type: "array", items: ref("HeldCart") }) },
    }),
    post: operation({
      tag: "POS",
      summary: "Hold a cart (F8)",
      body: fromZod(heldCartCreateSchema),
      responses: { 201: success("Held cart", ref("HeldCart")) },
    }),
  },
  "/api/v1/pos/held-carts/{id}": {
    get: operation({
      tag: "POS",
      summary: "Get a held cart",
      parameters: [pathParam("id")],
      responses: { 200: success("Held cart", ref("HeldCart")) },
    }),
    delete: operation({
      tag: "POS",
      summary: "Discard a held cart",
      parameters: [pathParam("id")],
      responses: { 200: success("Removed", { type: "null" }) },
    }),
  },
  "/api/v1/invoices": {
    get: operation({
      tag: "Invoices",
      summary: "List invoices",
      description:
        "`from`/`to` are calendar days in the app timezone (inclusive). `status=OVERDUE` = unpaid past the due date.",
      parameters: queryParams(listInvoicesQuerySchema),
      responses: { 200: success("Invoices", { type: "array", items: ref("InvoiceSummary") }, { paginated: true }) },
    }),
    post: operation({
      tag: "Invoices",
      summary: "Charge (post an invoice)",
      description:
        `Requires \`invoice.create\` and an open shift. ${branch} Send an \`Idempotency-Key\` header: a retry with the same key and body ` +
        "returns the first invoice (200); a different body is 409. Unpaid balance = credit sale (customer required, within credit limit). " +
        "Discounts above the role limit or credit above the customer's limit return 403 `APPROVAL_REQUIRED` with `details.approvals`; " +
        "resend with `override: { email, password }` of a manager holding `discount.override` / `credit.override`.",
      parameters: [
        { name: "Idempotency-Key", in: "header", required: false, schema: { type: "string", maxLength: 100 } },
      ],
      body: fromZod(createInvoiceSchema),
      responses: {
        201: success("Invoice", ref("InvoiceDetail")),
        200: success("Replayed invoice", ref("InvoiceDetail")),
      },
    }),
  },
  "/api/v1/invoices/opening-balance": {
    post: operation({
      tag: "Invoices",
      summary: "Add a customer's old dues (opening balance)",
      description:
        `Requires \`dues.opening\`. ${branch} Saves an invoice of kind OPENING_BALANCE (number series OB) with no lines or tax. ` +
        "It counts in the customer's dues, is collected with POST /invoices/{id}/payments and becomes overdue after the " +
        "customer's days to clear dues, counted from `asOfDate`. It never counts as a sale (sales, GST, Tally sales, dashboard sales).",
      body: fromZod(createOpeningBalanceSchema),
      responses: { 201: success("Old dues", ref("InvoiceDetail")) },
    }),
  },
  "/api/v1/invoices/customer-credit/{customerId}": {
    get: operation({
      tag: "Invoices",
      summary: "Customer credit limit and outstanding",
      parameters: [pathParam("customerId")],
      responses: { 200: success("Credit", ref("CustomerCredit")) },
    }),
  },
  "/api/v1/invoices/{id}": {
    get: operation({
      tag: "Invoices",
      summary: "Get an invoice",
      parameters: [pathParam("id")],
      responses: { 200: success("Invoice", ref("InvoiceDetail")) },
    }),
  },
  "/api/v1/invoices/{id}/print": {
    get: operation({
      tag: "Invoices",
      summary: "Invoice with business, branch, amount in words and tax summary",
      parameters: [pathParam("id")],
      responses: { 200: success("Print data", ref("InvoicePrint")) },
    }),
  },
  "/api/v1/invoices/{id}/cancel": {
    post: operation({
      tag: "Invoices",
      summary: "Cancel an invoice",
      description:
        "Requires `invoice.cancel`. Stock returns, payments are refunded by method, the number is kept. 409 if it has credit notes.",
      parameters: [pathParam("id")],
      body: fromZod(cancelInvoiceSchema),
      responses: { 200: success("Invoice", ref("InvoiceDetail")) },
    }),
  },
  "/api/v1/invoices/{id}/payments": {
    post: operation({
      tag: "Invoices",
      summary: "Record a payment",
      description: "Requires `invoice.create`. Up to the balance due.",
      parameters: [pathParam("id")],
      body: fromZod(createPaymentSchema),
      responses: { 201: success("Invoice", ref("InvoiceDetail")) },
    }),
  },
  "/api/v1/payments/{id}/reverse": {
    post: operation({
      tag: "Invoices",
      summary: "Reverse a payment",
      description: "Requires `invoice.cancel`. Adds a negative REVERSAL row; a payment can be reversed once.",
      parameters: [pathParam("id")],
      body: fromZod(reversePaymentSchema),
      responses: { 200: success("Invoice", ref("InvoiceDetail")) },
    }),
  },
  "/api/v1/credit-notes": {
    get: operation({
      tag: "Invoices",
      summary: "List credit notes",
      parameters: queryParams(listCreditNotesQuerySchema),
      responses: { 200: success("Credit notes", { type: "array", items: ref("CreditNote") }, { paginated: true }) },
    }),
    post: operation({
      tag: "Invoices",
      summary: "Create a credit note (sales return)",
      description:
        "Requires `invoice.cancel`. Returned parts go back to stock; the invoice balance drops; any overpayment is refunded with `refundMode`.",
      body: fromZod(createCreditNoteSchema),
      responses: { 201: success("Credit note", ref("CreditNote")) },
    }),
  },
  "/api/v1/credit-notes/{id}": {
    get: operation({
      tag: "Invoices",
      summary: "Get a credit note",
      parameters: [pathParam("id")],
      responses: { 200: success("Credit note", ref("CreditNote")) },
    }),
  },
};
