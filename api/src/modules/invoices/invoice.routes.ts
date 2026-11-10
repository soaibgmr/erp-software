import { Router } from "express";
import { container } from "../../config/inversify.config";
import { TYPES } from "../../config/ioc.types";
import { idParamSchema } from "../../common/schemas";
import type { AuthMiddleware } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import type { InvoiceController } from "./invoice.controller";
import {
  cancelInvoiceSchema,
  createCreditNoteSchema,
  createInvoiceSchema,
  createOpeningBalanceSchema,
  createPaymentSchema,
  customerIdParamSchema,
  listCreditNotesQuerySchema,
  listInvoicesQuerySchema,
  reversePaymentSchema,
} from "./invoice.schema";

const controller = container.get<InvoiceController>(TYPES.InvoiceController);
const { requireAuth, requirePermission, requireBranch, optionalBranch } = container.get<AuthMiddleware>(
  TYPES.AuthMiddleware,
);
const view = requirePermission("invoice.view", "invoice.create");
const create = requirePermission("invoice.create");
const cancel = requirePermission("invoice.cancel");

// ---------- /invoices ----------
export const invoicesRouter = Router();

invoicesRouter.use(requireAuth);

invoicesRouter.get("/", view, optionalBranch, validate({ query: listInvoicesQuerySchema }), controller.list);
// Credit limit, outstanding and available credit, for the POS customer panel.
invoicesRouter.get(
  "/customer-credit/:customerId",
  requirePermission("invoice.view", "invoice.create", "pos.use"),
  validate({ params: customerIdParamSchema }),
  controller.customerCredit,
);
invoicesRouter.post("/", create, requireBranch, validate({ body: createInvoiceSchema }), controller.charge);
// A customer's old dues (opening balance) at go-live.
invoicesRouter.post(
  "/opening-balance",
  requirePermission("dues.opening"),
  requireBranch,
  validate({ body: createOpeningBalanceSchema }),
  controller.createOpeningBalance,
);
invoicesRouter.get("/:id", view, validate({ params: idParamSchema }), controller.getById);
invoicesRouter.get("/:id/print", view, validate({ params: idParamSchema }), controller.print);
invoicesRouter.post(
  "/:id/cancel",
  cancel,
  validate({ params: idParamSchema, body: cancelInvoiceSchema }),
  controller.cancel,
);
invoicesRouter.post(
  "/:id/payments",
  create,
  validate({ params: idParamSchema, body: createPaymentSchema }),
  controller.recordPayment,
);

// ---------- /payments ----------
export const paymentsRouter = Router();

paymentsRouter.use(requireAuth);
paymentsRouter.post(
  "/:id/reverse",
  cancel,
  validate({ params: idParamSchema, body: reversePaymentSchema }),
  controller.reversePayment,
);

// ---------- /credit-notes ----------
export const creditNotesRouter = Router();

creditNotesRouter.use(requireAuth);
creditNotesRouter.get(
  "/",
  view,
  optionalBranch,
  validate({ query: listCreditNotesQuerySchema }),
  controller.listCreditNotes,
);
creditNotesRouter.get("/:id", view, validate({ params: idParamSchema }), controller.getCreditNote);
creditNotesRouter.post("/", cancel, validate({ body: createCreditNoteSchema }), controller.createCreditNote);
