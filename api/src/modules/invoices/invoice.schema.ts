import { z } from "zod";
import { INVOICE_KINDS, INVOICE_STATUSES, PAYMENT_METHODS } from "@automobile/shared";
import { paginationQuery, searchQuery } from "../../common/schemas";

export {
  creditNoteCreateSchema as createCreditNoteSchema,
  invoiceCancelSchema as cancelInvoiceSchema,
  invoiceCreateSchema as createInvoiceSchema,
  openingBalanceCreateSchema as createOpeningBalanceSchema,
  paymentCreateSchema as createPaymentSchema,
  paymentReverseSchema as reversePaymentSchema,
} from "@automobile/shared";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const listInvoicesQuerySchema = z.object({
  ...paginationQuery,
  search: searchQuery,
  status: z.enum(INVOICE_STATUSES).optional(),
  customerId: z.uuid().optional(),
  kind: z.enum(INVOICE_KINDS).optional(),
  paymentMode: z.enum(PAYMENT_METHODS).optional(),
  from: day.optional(),
  to: day.optional(),
  // Defaults to the x-branch-id header; "all" lists every branch the user can access.
  branchId: z.union([z.uuid(), z.literal("all")]).optional(),
});

export const listCreditNotesQuerySchema = z.object({
  ...paginationQuery,
  invoiceId: z.uuid().optional(),
});

export const customerIdParamSchema = z.object({ customerId: z.uuid() });

// Sent by the POS on every charge; a retry reuses the same key.
export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8, "Idempotency-Key must be 8–100 characters")
  .max(100, "Idempotency-Key must be 8–100 characters")
  .regex(/^[\w.:-]+$/, "Idempotency-Key may contain letters, digits, _ . : - only");
