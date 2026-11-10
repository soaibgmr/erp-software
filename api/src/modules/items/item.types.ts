import type { ItemCreate, ItemUnit, ItemUpdate, StockStatus } from "@automobile/shared";

export type CreateItemDto = ItemCreate;
export type UpdateItemDto = ItemUpdate;

// Stock of one item in one branch. Quantities are Decimal strings with 3 places ("12.000").
export interface ItemStockDto {
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

export interface ItemResponseDto {
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
  // Money as Decimal strings with 2 places.
  mrp: string | null;
  salePrice: string;
  purchasePrice: string;
  taxInclusive: boolean;
  isActive: boolean;
  barcodes: string[];
  compatibleModels: { id: string; name: string; makeName: string }[];
  // Stock in the branch from the x-branch-id header (null when no branch was sent).
  stock: ItemStockDto | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ItemDetailDto extends ItemResponseDto {
  // Every branch the user can see, including branches that never held the item.
  stockByBranch: (ItemStockDto & { branchCode: string; branchName: string })[];
}

// Compact row for the POS part picker.
export interface ItemSearchResultDto {
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
  // Why it matched: an exact barcode/SKU hit sorts first.
  exact: boolean;
  stock: Pick<ItemStockDto, "onHand" | "reserved" | "available" | "status"> | null;
}

export interface ListItemsQuery {
  page: number;
  limit: number;
  search?: string;
  categoryId?: string;
  brandId?: string;
  isActive?: boolean;
  sort: "name" | "sku" | "recent";
}

export interface ItemWriteData {
  sku?: string;
  name?: string;
  oemPartNo?: string | null;
  description?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  hsnCode?: string | null;
  gstRate?: number;
  unit?: ItemUnit;
  mrp?: number | null;
  salePrice?: number;
  purchasePrice?: number;
  taxInclusive?: boolean;
  isActive?: boolean;
  createdById?: string;
  // Replace the whole set when given.
  barcodes?: string[];
  compatibleModelIds?: string[];
}
