import type { Prisma } from "@prisma/client";
import type { Paginated } from "../../../common/pagination";
import type { Db } from "../../../common/prisma-types";
import type { BranchStockRow } from "../../stock/stock.mapper";
import type { ItemResponseDto, ItemSearchResultDto, ItemWriteData, ListItemsQuery } from "../item.types";

export interface IItemRepository {
  // `branchId` fills `stock` for that branch.
  findById(id: string, branchId?: string): Promise<ItemResponseDto | null>;
  list(query: ListItemsQuery, branchId?: string): Promise<Paginated<ItemResponseDto>>;
  // Active items only; exact SKU / OEM / barcode matches first.
  search(term: string, limit: number, branchId?: string): Promise<ItemSearchResultDto[]>;
  // Exact barcode or SKU.
  findByCode(code: string, branchId?: string): Promise<ItemSearchResultDto | null>;
  findSkuOwner(sku: string, excludeId?: string): Promise<{ id: string; name: string } | null>;
  findBarcodeOwners(codes: string[], excludeId?: string): Promise<{ code: string; itemId: string; itemName: string }[]>;
  countActiveModels(ids: string[]): Promise<number>;
  create(data: ItemWriteData, db?: Db): Promise<{ id: string }>;
  // Replaces barcodes / compatibility when they are given.
  update(id: string, data: ItemWriteData, db?: Db): Promise<boolean>;
  softDelete(id: string): Promise<boolean>;
  // Any branch with on-hand, reserved or in-transit quantity.
  hasStock(id: string): Promise<boolean>;
  stockRows(itemId: string): Promise<BranchStockRow[]>;
  findBySkus(skus: string[]): Promise<{ id: string; sku: string; name: string; purchasePrice: Prisma.Decimal }[]>;
}
