import type { AuthContext } from "../../../common/auth-context";
import type { Paginated } from "../../../common/pagination";
import type {
  CreateCreditNoteDto,
  CreateInvoiceDto,
  CreateOpeningBalanceDto,
  CreatePaymentDto,
  CreditNoteDto,
  CustomerCredit,
  InvoiceDetailDto,
  InvoicePrintDto,
  InvoiceSummaryDto,
  ListCreditNotesQuery,
  ListInvoicesQuery,
  PricedCartResult,
  QuoteDtoInput,
} from "../invoice.types";

// Resolves a cart against master data and prices it with the shared GST engine.
export interface ICartPricer {
  price(auth: AuthContext, branchId: string, input: QuoteDtoInput): Promise<PricedCartResult>;
  customerCredit(auth: AuthContext, customerId: string): Promise<CustomerCredit>;
}

export interface IInvoicePostingService {
  // POS charge. With an idempotency key, a retry of the same body returns the first invoice
  // (replayed = true) and a different body with the same key is a 409.
  charge(
    auth: AuthContext,
    branchId: string,
    input: CreateInvoiceDto,
    idempotencyKey?: string,
  ): Promise<{ invoice: InvoiceDetailDto; replayed: boolean }>;
}

// Emails a bill to a customer.
export interface IInvoiceMailer {
  // Sends now; throws when it fails.
  send(auth: AuthContext, invoiceId: string, to: string): Promise<void>;
  // Sends without delaying the caller; failures are logged.
  emailInBackground(auth: AuthContext, invoiceId: string, to: string): void;
}

export interface IInvoiceService {
  list(
    auth: AuthContext,
    currentBranchId: string | undefined,
    query: ListInvoicesQuery,
  ): Promise<Paginated<InvoiceSummaryDto>>;
  getById(auth: AuthContext, id: string): Promise<InvoiceDetailDto>;
  print(auth: AuthContext, id: string): Promise<InvoicePrintDto>;
  // Stock comes back, payments are refunded by method, the number is kept.
  cancel(auth: AuthContext, id: string, reason: string): Promise<InvoiceDetailDto>;
}

// A customer's old dues entered at go-live (an OPENING_BALANCE invoice).
export interface IOpeningBalanceService {
  create(auth: AuthContext, branchId: string, input: CreateOpeningBalanceDto): Promise<InvoiceDetailDto>;
}

export interface IPaymentService {
  record(auth: AuthContext, invoiceId: string, input: CreatePaymentDto): Promise<InvoiceDetailDto>;
  reverse(auth: AuthContext, paymentId: string, reason: string): Promise<InvoiceDetailDto>;
}

export interface ICreditNoteService {
  create(auth: AuthContext, input: CreateCreditNoteDto): Promise<CreditNoteDto>;
  getById(auth: AuthContext, id: string): Promise<CreditNoteDto>;
  list(
    auth: AuthContext,
    currentBranchId: string | undefined,
    query: ListCreditNotesQuery,
  ): Promise<Paginated<CreditNoteDto>>;
}
