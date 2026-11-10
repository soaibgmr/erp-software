import type { UserRef } from "../../../common/user-names";
import type {
  CustomerPaymentRow,
  DayBookRow,
  GstCreditNoteRateRow,
  GstInvoiceRateRow,
  HsnRow,
  OpenDocumentRow,
  PaymentsByModeRow,
  Period,
  SalesByCategoryRow,
  SalesByCustomerRow,
  SalesByDayRow,
  SalesByItemRow,
  SalesInvoiceRow,
  ShiftReportRow,
  StockMovementRow,
  StockValuationRow,
} from "../report.types";

export interface IReportRepository {
  userNames(ids: string[]): Promise<Map<string, UserRef>>;
  // Every invoice in the period, cancelled ones included (their amounts are zeroed by the service).
  salesInvoices(branchIds: string[], p: Period, customerId?: string): Promise<SalesInvoiceRow[]>;
  salesByDay(branchIds: string[], p: Period): Promise<SalesByDayRow[]>;
  salesByCustomer(branchIds: string[], p: Period): Promise<SalesByCustomerRow[]>;
  salesByItem(branchIds: string[], p: Period): Promise<SalesByItemRow[]>;
  salesByCategory(branchIds: string[], p: Period): Promise<SalesByCategoryRow[]>;
  paymentsByMode(branchIds: string[], p: Period): Promise<PaymentsByModeRow[]>;
  dayBook(branchIds: string[], p: Period): Promise<DayBookRow[]>;
  shifts(branchIds: string[], p: Period): Promise<ShiftReportRow[]>;
  // Non-cancelled invoices, one row per invoice and GST rate.
  gstInvoiceRates(branchIds: string[], p: Period): Promise<GstInvoiceRateRow[]>;
  gstCreditNoteRates(branchIds: string[], p: Period): Promise<GstCreditNoteRateRow[]>;
  // Sales minus credit notes per HSN/SAC, kind, unit and rate.
  hsnSummary(branchIds: string[], p: Period): Promise<HsnRow[]>;
  openInvoices(branchIds: string[], timeZone: string): Promise<OpenDocumentRow[]>;
  stockValuation(branchIds: string[]): Promise<StockValuationRow[]>;
  stockMovement(branchIds: string[], p: Period): Promise<StockMovementRow[]>;
  customerPayments(branchIds: string[], p: Period): Promise<CustomerPaymentRow[]>;
  businessName(): Promise<{ legalName: string; gstin: string | null }>;
}
