import type { Prisma } from "@prisma/client";
import type { Paginated } from "../../../common/pagination";
import type { Db } from "../../../common/prisma-types";
import type { BranchStockRow } from "../../stock/stock.mapper";
import type { ItemResponseDto, ItemSearchResultDto, ItemWriteData, ListItemsQuery } from "../item.types";

// Items belong to one business; every lookup is limited to it. Item ids found this way are then safe
// to use for branch stock (stockRows, hasStock).
export interface IItemRepository {
  // `branchId` fills `stock` for that branch.
  findById(businessId: string, id: string, branchId?: string): Promise<ItemResponseDto | null>;
  list(businessId: string, query: ListItemsQuery, branchId?: string): Promise<Paginated<ItemResponseDto>>;
  // Active items only; exact SKU / OEM / barcode matches first.
  search(businessId: string, term: string, limit: number, branchId?: string): Promise<ItemSearchResultDto[]>;
  // Exact barcode or SKU.
  findByCode(businessId: string, code: string, branchId?: string): Promise<ItemSearchResultDto | null>;
  findSkuOwner(businessId: string, sku: string, excludeId?: string): Promise<{ id: string; name: string } | null>;
  findBarcodeOwners(
    businessId: string,
    codes: string[],
    excludeId?: string,
  ): Promise<{ code: string; itemId: string; itemName: string }[]>;
  countActiveModels(businessId: string, ids: string[]): Promise<number>;
  create(businessId: string, data: ItemWriteData, db?: Db): Promise<{ id: string }>;
  // Replaces barcodes / compatibility when they are given.
  update(businessId: string, id: string, data: ItemWriteData, db?: Db): Promise<boolean>;
  softDelete(businessId: string, id: string): Promise<boolean>;
  // Any branch with on-hand, reserved or in-transit quantity.
  hasStock(id: string): Promise<boolean>;
  stockRows(itemId: string): Promise<BranchStockRow[]>;
  findBySkus(
    businessId: string,
    skus: string[],
  ): Promise<{ id: string; sku: string; name: string; purchasePrice: Prisma.Decimal }[]>;
}
