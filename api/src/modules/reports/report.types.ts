// Rows read by ReportRepository. Money and quantities arrive as numeric text from PostgreSQL.

export interface Period {
  // Inclusive calendar days in the app timezone.
  fromDay: string;
  toDay: string;
  // [start, end) as instants.
  start: Date;
  end: Date;
  timeZone: string;
}

export interface SalesInvoiceRow {
  id: string;
  number: string;
  invoiceDate: Date;
  branchCode: string;
  customerName: string | null;
  customerGstin: string | null;
  status: string;
  taxable: string;
  cgst: string;
  sgst: string;
  igst: string;
  roundOff: string;
  grandTotal: string;
  paid: string;
  credited: string;
}

export interface SalesByDayRow {
  day: string;
  bills: number;
  taxable: string;
  tax: string;
  total: string;
}

export interface SalesByCustomerRow {
  customerId: string | null;
  name: string;
  mobile: string | null;
  bills: number;
  taxable: string;
  tax: string;
  total: string;
  balance: string;
}

export interface SalesByItemRow {
  kind: string;
  sku: string | null;
  description: string;
  unit: string;
  quantity: string;
  returnedQty: string;
  taxable: string;
  tax: string;
  total: string;
}

export interface SalesByCategoryRow {
  category: string;
  lines: number;
  quantity: string;
  taxable: string;
  tax: string;
  total: string;
}

export interface PaymentsByModeRow {
  mode: string;
  receipts: number;
  received: string;
  returned: string;
  net: string;
}

export interface DayBookRow {
  at: Date;
  type: string;
  number: string;
  party: string;
  mode: string | null;
  value: string | null;
  moneyIn: string;
  moneyOut: string;
}

export interface ShiftReportRow {
  id: string;
  branchCode: string;
  counter: string;
  userId: string;
  openedAt: Date;
  closedAt: Date | null;
  status: string;
  openingCash: string;
  counted: Record<string, string> | null;
  bills: number;
  sales: string;
  netPayments: string;
}

// One row per document and GST rate.
export interface GstInvoiceRateRow {
  id: string;
  number: string;
  date: Date;
  customerGstin: string | null;
  customerName: string | null;
  placeOfSupply: string;
  supplyType: "INTRA_STATE" | "INTER_STATE";
  grandTotal: string;
  roundOff: string;
  rate: string;
  taxable: string;
  cgst: string;
  sgst: string;
  igst: string;
}

export interface GstCreditNoteRateRow extends GstInvoiceRateRow {
  invoiceNumber: string;
  invoiceDate: Date;
  invoiceGrandTotal: string;
}

export interface HsnRow {
  hsn: string;
  description: string | null;
  kind: string;
  unit: string;
  rate: string;
  quantity: string;
  taxable: string;
  cgst: string;
  sgst: string;
  igst: string;
}

export interface OpenDocumentRow {
  partyId: string | null;
  party: string;
  mobile: string | null;
  // YYYY-MM-DD
  dueDate: string;
  owed: string;
}

export interface StockValuationRow {
  itemId: string;
  sku: string;
  name: string;
  category: string | null;
  unit: string;
  onHand: string;
  purchasePrice: string;
  salePrice: string;
  lastSaleAt: Date | null;
}

export interface StockMovementRow {
  itemId: string;
  sku: string;
  name: string;
  unit: string;
  opening: string;
  inward: string;
  outward: string;
  sold: string;
}

export interface CustomerPaymentRow {
  id: string;
  receivedAt: Date;
  mode: string;
  amount: string;
  kind: string | null;
  reference: string | null;
  invoiceNumber: string;
  party: string;
}
