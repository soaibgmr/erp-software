import type { Paginated } from "../../../common/pagination";
import type { Db } from "../../../common/prisma-types";
import type {
  CreateCreditNoteData,
  CreateInvoiceData,
  CreatePaymentData,
  CreditableLine,
  CreditNoteDto,
  InvoiceDetailDto,
  InvoiceListFilter,
  InvoiceSummaryDto,
  ListCreditNotesQuery,
  LockedInvoice,
  SaleItemRow,
  SaleLabourRow,
  StoredInvoiceStatus,
} from "../invoice.types";

export interface IInvoiceRepository {
  // ---- Master data for pricing ----
  // Non-deleted items with their sellable quantity (on hand − reserved) in the branch.
  findSaleItems(ids: string[], branchId: string): Promise<SaleItemRow[]>;
  findSaleLabour(ids: string[]): Promise<SaleLabourRow[]>;
  // Σ balance due of the customer's open invoices, in paise.
  customerOutstanding(customerId: string): Promise<number>;

  // ---- Invoices ----
  create(db: Db, data: CreateInvoiceData): Promise<{ id: string }>;
  findDetail(id: string): Promise<InvoiceDetailDto | null>;
  list(filter: InvoiceListFilter): Promise<Paginated<InvoiceSummaryDto>>;
  // SELECT … FOR UPDATE; amounts in paise.
  lockInvoice(db: Db, id: string): Promise<LockedInvoice | null>;
  updateTotals(
    db: Db,
    id: string,
    data: { paidPaise: number; creditedPaise: number; status: StoredInvoiceStatus },
  ): Promise<void>;
  markCancelled(db: Db, id: string, userId: string, reason: string): Promise<void>;

  // ---- Payments ----
  createPayment(db: Db, data: CreatePaymentData): Promise<{ id: string }>;
  findPayment(id: string): Promise<{
    id: string;
    invoiceId: string;
    branchId: string;
    mode: string;
    amountPaise: number;
    kind: string | null;
    reversed: boolean;
  } | null>;
  // Net amount received per method (receipts − reversals − refunds), in paise.
  paymentsByMode(db: Db, invoiceId: string): Promise<{ mode: string; amountPaise: number }[]>;

  // ---- Credit notes ----
  creditableLines(db: Db, invoiceId: string): Promise<CreditableLine[]>;
  createCreditNote(db: Db, data: CreateCreditNoteData): Promise<{ id: string }>;
  addReturned(db: Db, invoiceLineId: string, quantityMilli: number): Promise<void>;
  setCreditNoteRefund(db: Db, id: string, refundedPaise: number): Promise<void>;
  findCreditNote(id: string): Promise<CreditNoteDto | null>;
  listCreditNotes(branchIds: string[], query: ListCreditNotesQuery): Promise<Paginated<CreditNoteDto>>;
  countCreditNotes(invoiceId: string): Promise<number>;

  // ---- Reliability ----
  findIdempotency(
    userId: string,
    key: string,
  ): Promise<{ scope: string; requestHash: string; resourceId: string } | null>;
  saveIdempotency(
    db: Db,
    data: { userId: string; key: string; scope: string; requestHash: string; resourceId: string },
  ): Promise<void>;
  addOutboxEvent(db: Db, type: string, payload: Record<string, unknown>): Promise<void>;
}
