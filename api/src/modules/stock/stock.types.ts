import type {
  ItemUnit,
  StockAdjustmentCreate,
  StockAdjustmentReason,
  StockAdjustmentStatus,
  StockMovementType,
  StockSettingsUpdate,
  StockStatus,
  StockTransferCreate,
  StockTransferStatus,
} from "@erp-software/shared";
import type { ItemStockDto } from "../items/item.types";

// ---------- Ledger core ----------

// One change to an item's on-hand quantity in a branch. Every module that moves stock
// (adjustments, transfers, invoices, GRNs…) describes it with these and calls IStockService.post.
export interface StockMovement {
  branchId: string;
  itemId: string;
  type: StockMovementType;
  // Signed quantity in the item's unit (up to 3 decimals): +5 received, −2 sold.
  quantity: number;
  unitCost?: number | null;
  refType?: string;
  refId?: string;
  refNo?: string;
  note?: string | null;
}

export interface PostOptions {
  // Read the POS setting allowNegativeStock before opening the transaction and pass it here:
  // post() runs inside the caller's transaction and must not use another pooled connection.
  allowNegative: boolean;
}

// A locked branch_stock row; quantities in milli-units.
export interface LockedBalance {
  branchId: string;
  itemId: string;
  sku: string;
  name: string;
  onHand: number;
  reserved: number;
}

export interface LedgerInsert {
  branchId: string;
  itemId: string;
  type: StockMovementType;
  quantity: string;
  balanceAfter: string;
  unitCost: string | null;
  refType: string | null;
  refId: string | null;
  refNo: string | null;
  note: string | null;
  createdById: string | null;
}

// ---------- Queries ----------

export interface StockRowDto extends ItemStockDto {
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

export interface ListStockQuery {
  page: number;
  limit: number;
  search?: string;
  categoryId?: string;
  brandId?: string;
  status?: StockStatus;
  // A branch id, or "all" for every branch the user can access.
  branchId?: string;
  sort: "name" | "sku" | "available";
}

export interface StockListFilter extends Omit<ListStockQuery, "branchId"> {
  branchIds: string[];
  // Single-branch lists include items never stocked there (zero rows); multi-branch lists don't.
  includeEmpty: boolean;
}

export interface LedgerEntryDto {
  id: string;
  type: StockMovementType;
  quantity: string;
  balanceAfter: string;
  unitCost: string | null;
  refType: string | null;
  refId: string | null;
  refNo: string | null;
  note: string | null;
  createdAt: Date;
  createdBy: { id: string; name: string } | null;
}

export interface LedgerQuery {
  page: number;
  limit: number;
  branchId?: string;
}

export type UpdateStockSettingsDto = StockSettingsUpdate;

export interface LineItem {
  id: string;
  sku: string;
  name: string;
  unit: ItemUnit;
  purchasePrice: string;
}

// ---------- Adjustments ----------

export type CreateStockAdjustmentDto = StockAdjustmentCreate;

export interface StockAdjustmentLineDto {
  itemId: string;
  sku: string;
  name: string;
  unit: ItemUnit;
  quantity: string;
  unitCost: string;
  value: string;
}

export interface StockAdjustmentDto {
  id: string;
  number: string;
  branchId: string;
  reason: StockAdjustmentReason;
  note: string | null;
  status: StockAdjustmentStatus;
  totalValue: string;
  lineCount: number;
  createdBy: { id: string; name: string } | null;
  decidedBy: { id: string; name: string } | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  createdAt: Date;
}

export interface StockAdjustmentDetailDto extends StockAdjustmentDto {
  lines: StockAdjustmentLineDto[];
}

export interface ListAdjustmentsQuery {
  page: number;
  limit: number;
  status?: StockAdjustmentStatus;
}

export interface CreateAdjustmentData {
  number: string;
  branchId: string;
  reason: StockAdjustmentReason;
  note: string | null;
  status: StockAdjustmentStatus;
  totalValue: string;
  createdById: string;
  lines: { itemId: string; quantity: string; unitCost: string }[];
}

// ---------- Transfers ----------

export type CreateStockTransferDto = StockTransferCreate;

export interface StockTransferLineDto {
  itemId: string;
  sku: string;
  name: string;
  unit: ItemUnit;
  quantity: string;
  unitCost: string;
}

export interface StockTransferDto {
  id: string;
  number: string;
  status: StockTransferStatus;
  fromBranch: { id: string; code: string; name: string };
  toBranch: { id: string; code: string; name: string };
  note: string | null;
  lineCount: number;
  totalQuantity: string;
  createdBy: { id: string; name: string } | null;
  closedBy: { id: string; name: string } | null;
  closedAt: Date | null;
  createdAt: Date;
}

export interface StockTransferDetailDto extends StockTransferDto {
  lines: StockTransferLineDto[];
}

export interface ListTransfersQuery {
  page: number;
  limit: number;
  // Relative to the current branch.
  direction: "all" | "in" | "out";
  status?: StockTransferStatus;
}

export interface CreateTransferData {
  number: string;
  fromBranchId: string;
  toBranchId: string;
  note: string | null;
  createdById: string;
  lines: { itemId: string; quantity: string; unitCost: string }[];
}

// ---------- Import ----------

export type ImportRowAction = "create" | "update" | "skip" | "error";

export interface ImportRowReport {
  row: number; // line in the file, header = 1
  sku: string;
  name: string;
  action: ImportRowAction;
  openingQty: string | null; // posted as opening stock; null when none or ignored
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
