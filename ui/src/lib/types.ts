// Response shapes from the API (see the OpenAPI document at /docs).
import type {
  BusinessStatus,
  CustomerType,
  DocumentType,
  HsnSacKind,
  InvoiceKind,
  InvoiceStatus,
  ItemUnit,
  PaymentMethod,
  Permission,
  StockAdjustmentReason,
  StockAdjustmentStatus,
  StockMovementType,
  StockStatus,
  StockStatus as StockStatusType,
  StockTransferStatus,
  SupplyType,
  UserStatus,
} from "@erp-software/shared";

export interface BranchSummary {
  id: string;
  code: string;
  name: string;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  // Login id, unique across every shop.
  mobile: string | null;
  email: string | null;
  emailVerifiedAt: string | null;
  phone: string | null;
  status: UserStatus;
  lastLoginAt: string | null;
  role: { id: string; key: string | null; name: string };
  branches: BranchSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface Me {
  user: User;
  business: { id: string; name: string; status: BusinessStatus };
  isOwner: boolean;
  permissions: Permission[];
  branches: (BranchSummary & { stateCode: string; city: string | null })[];
}

export interface Role {
  id: string;
  key: string | null;
  name: string;
  description: string | null;
  permissions: Permission[];
  isSystem: boolean;
  userCount: number;
}

export interface PermissionGroup {
  group: string;
  permissions: { code: Permission; label: string }[];
}

export interface Branch {
  id: string;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  pincode: string | null;
  stateCode: string;
  gstin: string | null;
  phone: string | null;
  isActive: boolean;
}

export interface Business {
  id: string;
  legalName: string;
  tradeName: string | null;
  address: string | null;
  city: string | null;
  pincode: string | null;
  stateCode: string;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankIfsc: string | null;
  upiId: string | null;
  updatedAt: string;
}

export interface Customer {
  id: string;
  type: CustomerType;
  name: string;
  mobile: string;
  alternatePhone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  pincode: string | null;
  stateCode: string | null;
  gstin: string | null;
  creditLimit: string;
  creditDays: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSequence {
  branchId: string;
  docType: DocumentType;
  label: string;
  financialYear: number;
  financialYearLabel: string;
  prefix: string;
  padding: number;
  nextNumber: number;
  preview: string;
  inUse: boolean;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  branchId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
  actor: { id: string; firstName: string; lastName: string } | null;
}

// ---------- Phase 2: catalog, items, stock ----------
// Money: Decimal strings with 2 places. Quantities: Decimal strings with 3 places ("12.000").

export interface Category {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
}

export interface Brand {
  id: string;
  name: string;
  itemCount: number;
}

export interface HsnSac {
  id: string;
  code: string;
  kind: HsnSacKind;
  description: string;
  gstRate: number;
}

export interface VehicleMake {
  id: string;
  name: string;
  modelCount: number;
}

export interface VehicleModel {
  id: string;
  makeId: string;
  makeName: string;
  name: string;
}

export interface ItemStock {
  branchId: string;
  onHand: string;
  reserved: string;
  available: string;
  inTransit: string;
  minLevel: string;
  reorderQty: string;
  binLocation: string | null;
  status: StockStatus;
}

export interface Item {
  id: string;
  sku: string;
  name: string;
  oemPartNo: string | null;
  description: string | null;
  category: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
  hsnCode: string | null;
  gstRate: number;
  unit: ItemUnit;
  mrp: string | null;
  salePrice: string;
  purchasePrice: string;
  taxInclusive: boolean;
  isActive: boolean;
  barcodes: string[];
  compatibleModels: { id: string; name: string; makeName: string }[];
  // For the current branch (x-branch-id).
  stock: ItemStock | null;
  createdAt: string;
  updatedAt: string;
}

export interface ItemDetail extends Item {
  stockByBranch: (ItemStock & { branchCode: string; branchName: string })[];
}

export interface ItemSearchResult {
  id: string;
  sku: string;
  name: string;
  oemPartNo: string | null;
  brandName: string | null;
  hsnCode: string | null;
  gstRate: number;
  unit: ItemUnit;
  mrp: string | null;
  salePrice: string;
  taxInclusive: boolean;
  exact: boolean;
  stock: Pick<ItemStock, "onHand" | "reserved" | "available" | "status"> | null;
}

export interface StockRow extends ItemStock {
  itemId: string;
  sku: string;
  name: string;
  oemPartNo: string | null;
  unit: ItemUnit;
  brandName: string | null;
  categoryName: string | null;
  salePrice: string;
  purchasePrice: string;
  branchCode: string;
  branchName: string;
}

export interface UserRef {
  id: string;
  name: string;
}

export interface LedgerEntry {
  id: string;
  type: StockMovementType;
  quantity: string;
  balanceAfter: string;
  unitCost: string | null;
  refType: string | null;
  refId: string | null;
  refNo: string | null;
  note: string | null;
  createdAt: string;
  createdBy: UserRef | null;
}

export interface DocLine {
  itemId: string;
  sku: string;
  name: string;
  unit: ItemUnit;
  quantity: string;
  unitCost: string;
}

export interface StockAdjustment {
  id: string;
  number: string;
  branchId: string;
  reason: StockAdjustmentReason;
  note: string | null;
  status: StockAdjustmentStatus;
  totalValue: string;
  lineCount: number;
  createdBy: UserRef | null;
  decidedBy: UserRef | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
}

export interface StockAdjustmentDetail extends StockAdjustment {
  lines: (DocLine & { value: string })[];
}

export interface StockTransfer {
  id: string;
  number: string;
  status: StockTransferStatus;
  fromBranch: BranchSummary;
  toBranch: BranchSummary;
  note: string | null;
  lineCount: number;
  totalQuantity: string;
  createdBy: UserRef | null;
  closedBy: UserRef | null;
  closedAt: string | null;
  createdAt: string;
}

export interface StockTransferDetail extends StockTransfer {
  lines: DocLine[];
}

export interface ImportRowReport {
  row: number;
  sku: string;
  name: string;
  action: "create" | "update" | "skip" | "error";
  openingQty: string | null;
  errors: string[];
  warnings: string[];
}

export interface ImportReport {
  committed: boolean;
  total: number;
  errorCount: number;
  createCount: number;
  updateCount: number;
  skipCount: number;
  openingStockCount: number;
  newBrands: string[];
  newCategories: string[];
  unknownColumns: string[];
  rows: ImportRowReport[];
}

export interface LabourService {
  id: string;
  code: string | null;
  name: string;
  sacCode: string;
  gstRate: number;
  rate: string;
  standardHours: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------- Phase 3: POS, invoices, shifts ----------

export interface CustomerCredit {
  id: string;
  type: CustomerType;
  name: string;
  mobile: string;
  email: string | null;
  gstin: string | null;
  address: string | null;
  stateCode: string | null;
  creditLimit: string;
  creditDays: number;
  outstanding: string;
  availableCredit: string;
}

export interface QuoteLine {
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
  discount: string;
  taxable: string;
  tax: string;
  total: string;
  available: string | null;
  stockStatus: StockStatusType | null;
}

export interface Quote {
  supplyType: SupplyType;
  placeOfSupply: string;
  customer: CustomerCredit | null;
  lines: QuoteLine[];
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
  needsDiscountApproval: boolean;
  issues: { line?: number; message: string }[];
}

export interface InvoiceLine {
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

export interface Payment {
  id: string;
  invoiceId: string;
  mode: PaymentMethod;
  // Negative for reversals and refunds.
  amount: string;
  tendered: string | null;
  reference: string | null;
  note: string | null;
  kind: "RECEIPT" | "REVERSAL" | "REFUND";
  reversesPaymentId: string | null;
  reversed: boolean;
  receivedAt: string;
  createdBy: UserRef | null;
}

export interface InvoiceSummary {
  id: string;
  number: string;
  // SALE = tax invoice; OPENING_BALANCE = a customer's old dues.
  kind: InvoiceKind;
  branch: BranchSummary;
  invoiceDate: string;
  dueDate: string | null;
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

export interface InvoiceDetail extends InvoiceSummary {
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
  createdBy: UserRef | null;
  cancelledAt: string | null;
  cancelledBy: UserRef | null;
  cancelReason: string | null;
  discountApprovedBy: UserRef | null;
  creditApprovedBy: UserRef | null;
  lines: InvoiceLine[];
  payments: Payment[];
  creditNotes: { id: string; number: string; reason: string; total: string; refunded: string; createdAt: string }[];
  createdAt: string;
}

export interface InvoicePrint {
  invoice: InvoiceDetail;
  business: Business;
  branch: Branch;
  amountInWords: string;
  taxSummary: { gstRate: number; hsnSac: string | null; taxable: string; cgst: string; sgst: string; igst: string }[];
}

export interface CreditNote {
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
  createdBy: UserRef | null;
  createdAt: string;
  lines: {
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
  }[];
}

export interface ShiftReport {
  id: string;
  branchId: string;
  user: UserRef | null;
  counter: string;
  status: "OPEN" | "CLOSED";
  openingCash: string;
  openedAt: string;
  closedAt: string | null;
  closeNote: string | null;
  methods: { mode: PaymentMethod; expected: string; counted: string | null; variance: string | null }[];
  invoiceCount: number;
  salesTotal: string;
  cancelledCount: number;
  creditTotal: string;
}

export type Shift = Omit<ShiftReport, "methods" | "invoiceCount" | "salesTotal" | "cancelledCount" | "creditTotal">;

export interface HeldCart {
  id: string;
  branchId: string;
  label: string | null;
  customerId: string | null;
  customerName: string | null;
  lineCount: number;
  total: string;
  cart: {
    label?: string | null;
    customerId?: string | null;
    lines: ({ kind: "ITEM"; itemId: string } | { kind: "LABOUR"; labourServiceId: string })[] &
      { quantity: number; discount?: number }[];
    billDiscount?: { type: "AMOUNT" | "PERCENT"; value: number } | null;
  };
  createdAt: string;
  createdBy: UserRef | null;
}

// ---- Platform admin (approves shops) ----
export interface PlatformAdmin {
  id: string;
  name: string;
  email: string;
}

// "Book a quick demo" request from the landing page (platform admin console).
export interface DemoRequest {
  id: string;
  name: string | null;
  mobile: string;
  email: string | null;
  handledAt: string | null;
  createdAt: string;
}

export interface PlatformBusiness {
  id: string;
  name: string;
  legalName: string;
  city: string | null;
  stateCode: string;
  gstin: string | null;
  status: BusinessStatus;
  statusNote: string | null;
  approvedAt: string | null;
  createdAt: string;
  owner: { name: string; mobile: string | null; email: string | null; emailVerified: boolean } | null;
  branchCount: number;
  userCount: number;
}

// ---------- Phone scanner (a phone paired with the POS as a camera barcode scanner) ----------

export interface ScanSessionCreated {
  id: string;
  token: string;
  expiresAt: string;
}

export interface ScanPoll {
  scans: { id: string; code: string }[];
  phoneConnected: boolean;
  closed: boolean;
}

export interface ScanSessionInfo {
  shopName: string;
  branchName: string;
}

export interface ScanResult {
  found: boolean;
  name: string | null;
  salePrice: string | null;
}
