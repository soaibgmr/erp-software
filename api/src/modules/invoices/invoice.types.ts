import type {
  CreditNoteCreate,
  CustomerType,
  InvoiceCreate,
  InvoiceKind,
  InvoiceStatus,
  OpeningBalanceCreate,
  PaymentCreate,
  PaymentMethod,
  QuoteInput,
  StockStatus,
  SupplyType,
} from "@automobile/shared";

export type CreateInvoiceDto = InvoiceCreate;
export type QuoteDtoInput = QuoteInput;
export type CreatePaymentDto = PaymentCreate;
export type CreateCreditNoteDto = CreditNoteCreate;
export type CreateOpeningBalanceDto = OpeningBalanceCreate;

// Stored statuses; OVERDUE is derived on read.
export type StoredInvoiceStatus = Exclude<InvoiceStatus, "OVERDUE">;

// Money in DTOs: Decimal strings with 2 places. Quantities: 3 places.

// ---------- Pricing (quote / charge) ----------

export interface SaleItemRow {
  id: string;
  sku: string;
  name: string;
  unit: string;
  hsnCode: string | null;
  gstRate: number;
  salePrice: number;
  purchasePrice: number;
  taxInclusive: boolean;
  isActive: boolean;
  available: number | null; // in the branch, null if never stocked
}

export interface SaleLabourRow {
  id: string;
  name: string;
  sacCode: string;
  gstRate: number;
  rate: number;
  isActive: boolean;
}

export interface CustomerCredit {
  id: string;
  type: CustomerType;
  name: string;
  mobile: string;
  gstin: string | null;
  address: string | null;
  stateCode: string | null;
  creditLimit: string;
  creditDays: number;
  outstanding: string;
  availableCredit: string;
}

// A cart line with master data resolved and amounts computed.
export interface PricedLine {
  kind: "ITEM" | "LABOUR";
  itemId: string | null;
  labourServiceId: string | null;
  description: string;
  sku: string | null;
  hsnSac: string | null;
  unit: string;
  quantity: number;
  rate: number;
  taxInclusive: boolean;
  gstRate: number;
  unitCost: number | null;
  lineDiscountPaise: number;
  billDiscountPaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  available: number | null;
}

export interface QuoteLineDto {
  kind: "ITEM" | "LABOUR";
  itemId: string | null;
  labourServiceId: string | null;
  description: string;
  sku: string | null;
  hsnSac: string | null;
  unit: string;
  quantity: string;
  rate: string;
  gstRate: number;
  taxInclusive: boolean;
  discount: string; // line + bill share
  taxable: string;
  tax: string;
  total: string;
  // Sellable quantity in the branch (null for labour); the POS warns when the cart exceeds it.
  available: string | null;
  stockStatus: StockStatus | null;
}

export interface QuoteDto {
  supplyType: SupplyType;
  placeOfSupply: string;
  customer: CustomerCredit | null;
  lines: QuoteLineDto[];
  itemCount: number;
  gross: string;
  lineDiscount: string;
  billDiscount: string;
  discount: string;
  discountPercent: number;
  taxable: string;
  cgst: string;
  sgst: string;
  igst: string;
  tax: string;
  roundOff: string;
  total: string;
  maxDiscountPercent: number;
  // True when the discount is above the role limit and the user can't approve it.
  needsDiscountApproval: boolean;
  issues: { line?: number; message: string }[];
}

export interface PricedCartResult {
  quote: QuoteDto;
  lines: PricedLine[];
  totals: {
    grossPaise: number;
    discountPaise: number;
    discountBasisPoints: number;
    taxablePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    roundOffPaise: number;
    totalPaise: number;
  };
  customer: CustomerCredit | null;
  placeOfSupply: string;
  supplyType: SupplyType;
}

// ---------- Invoices ----------

export interface InvoiceLineDto {
  id: string;
  lineNo: number;
  kind: "ITEM" | "LABOUR";
  itemId: string | null;
  labourServiceId: string | null;
  description: string;
  sku: string | null;
  hsnSac: string | null;
  unit: string;
  quantity: string;
  rate: string;
  taxInclusive: boolean;
  gstRate: number;
  discount: string;
  taxable: string;
  cgst: string;
  sgst: string;
  igst: string;
  total: string;
  returnedQty: string;
}

export interface PaymentDto {
  id: string;
  invoiceId: string;
  mode: PaymentMethod;
  amount: string;
  tendered: string | null;
  reference: string | null;
  note: string | null;
  kind: "RECEIPT" | "REVERSAL" | "REFUND";
  reversesPaymentId: string | null;
  reversed: boolean;
  receivedAt: Date;
  createdBy: { id: string; name: string } | null;
}

export interface CreditNoteSummaryDto {
  id: string;
  number: string;
  reason: string;
  total: string;
  refunded: string;
  createdAt: Date;
}

export interface InvoiceSummaryDto {
  id: string;
  number: string;
  // SALE = tax invoice; OPENING_BALANCE = a customer's old dues.
  kind: InvoiceKind;
  branch: { id: string; code: string; name: string };
  invoiceDate: Date;
  dueDate: Date | null;
  status: InvoiceStatus;
  customerId: string | null;
  customerName: string | null;
  customerMobile: string | null;
  itemCount: number;
  grandTotal: string;
  paidTotal: string;
  creditedTotal: string;
  balanceDue: string;
  paymentModes: PaymentMethod[];
}

export interface InvoiceDetailDto extends InvoiceSummaryDto {
  customerGstin: string | null;
  customerAddress: string | null;
  placeOfSupply: string;
  supplyType: SupplyType;
  grossTotal: string;
  discountTotal: string;
  billDiscountType: string | null;
  billDiscountValue: string | null;
  taxableTotal: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  roundOff: string;
  notes: string | null;
  shiftId: string | null;
  createdBy: { id: string; name: string } | null;
  cancelledAt: Date | null;
  cancelledBy: { id: string; name: string } | null;
  cancelReason: string | null;
  discountApprovedBy: { id: string; name: string } | null;
  creditApprovedBy: { id: string; name: string } | null;
  lines: InvoiceLineDto[];
  payments: PaymentDto[];
  creditNotes: CreditNoteSummaryDto[];
  createdAt: Date;
}

export interface InvoicePrintDto {
  invoice: InvoiceDetailDto;
  business: Record<string, unknown>;
  branch: Record<string, unknown>;
  amountInWords: string;
  taxSummary: { gstRate: number; hsnSac: string | null; taxable: string; cgst: string; sgst: string; igst: string }[];
}

export interface ListInvoicesQuery {
  page: number;
  limit: number;
  search?: string;
  status?: InvoiceStatus;
  customerId?: string;
  kind?: InvoiceKind;
  paymentMode?: PaymentMethod;
  // Calendar days ("2026-11-09") in the app timezone; `to` is inclusive.
  from?: string;
  to?: string;
  branchId?: string; // uuid or "all"
}

export interface InvoiceListFilter extends Omit<ListInvoicesQuery, "branchId" | "from" | "to"> {
  branchIds: string[];
  from?: Date;
  to?: Date;
}

// Everything posting needs to write in one go.
export interface CreateInvoiceData {
  number: string;
  kind?: InvoiceKind;
  // Defaults to now (POS sales); old dues use the day they are counted from.
  invoiceDate?: Date;
  branchId: string;
  shiftId: string | null;
  customerId: string | null;
  customerName: string | null;
  customerMobile: string | null;
  customerGstin: string | null;
  customerAddress: string | null;
  placeOfSupply: string;
  supplyType: SupplyType;
  dueDate: Date | null;
  status: StoredInvoiceStatus;
  grossTotal: string;
  discountTotal: string;
  billDiscountType: string | null;
  billDiscountValue: string | null;
  taxableTotal: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  roundOff: string;
  grandTotal: string;
  paidTotal: string;
  notes: string | null;
  discountApprovedById: string | null;
  creditApprovedById: string | null;
  createdById: string;
  lines: {
    lineNo: number;
    kind: "ITEM" | "LABOUR";
    itemId: string | null;
    labourServiceId: string | null;
    description: string;
    sku: string | null;
    hsnSac: string | null;
    unit: string;
    quantity: string;
    rate: string;
    taxInclusive: boolean;
    gstRate: string;
    lineDiscount: string;
    billDiscount: string;
    taxable: string;
    cgst: string;
    sgst: string;
    igst: string;
    total: string;
    unitCost: string | null;
  }[];
}

export interface CreatePaymentData {
  invoiceId: string;
  branchId: string;
  shiftId: string | null;
  mode: PaymentMethod;
  amount: string; // negative for reversals and refunds
  tendered?: string | null;
  reference?: string | null;
  note?: string | null;
  kind?: "REVERSAL" | "REFUND" | null;
  reversesPaymentId?: string | null;
  creditNoteId?: string | null;
  createdById: string;
}

// Row locked for update while payments, cancellations or credit notes change it.
export interface LockedInvoice {
  id: string;
  number: string;
  branchId: string;
  customerId: string | null;
  status: StoredInvoiceStatus;
  grandTotal: number; // paise
  paidTotal: number;
  creditedTotal: number;
  supplyType: SupplyType;
}

// ---------- Credit notes ----------

export interface CreditNoteLineDto {
  invoiceLineId: string;
  description: string;
  sku: string | null;
  hsnSac: string | null;
  unit: string;
  quantity: string;
  rate: string;
  gstRate: number;
  taxable: string;
  cgst: string;
  sgst: string;
  igst: string;
  total: string;
}

export interface CreditNoteDto {
  id: string;
  number: string;
  branchId: string;
  invoice: { id: string; number: string; customerName: string | null };
  reason: string;
  taxableTotal: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  roundOff: string;
  total: string;
  refunded: string;
  createdBy: { id: string; name: string } | null;
  createdAt: Date;
  lines: CreditNoteLineDto[];
}

export interface ListCreditNotesQuery {
  page: number;
  limit: number;
  invoiceId?: string;
}

export interface CreateCreditNoteData {
  number: string;
  branchId: string;
  invoiceId: string;
  reason: string;
  taxableTotal: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  roundOff: string;
  total: string;
  refunded: string;
  createdById: string;
  lines: {
    invoiceLineId: string;
    quantity: string;
    taxable: string;
    cgst: string;
    sgst: string;
    igst: string;
    total: string;
  }[];
}

// Original invoice line with what earlier credit notes already took from it.
export interface CreditableLine {
  id: string;
  kind: "ITEM" | "LABOUR";
  itemId: string | null;
  description: string;
  quantity: number; // milli
  returned: number; // milli
  unitCost: number | null;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  credited: { taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number };
}
