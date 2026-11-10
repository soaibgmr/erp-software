import type { Paginated } from "../../../common/pagination";
import type { Db } from "../../../common/prisma-types";
import type { BranchStockRow } from "../stock.mapper";
import type {
  LedgerEntryDto,
  LedgerInsert,
  LineItem,
  LockedBalance,
  StockListFilter,
  StockRowDto,
  UpdateStockSettingsDto,
} from "../stock.types";

export interface IStockRepository {
  // Creates missing branch_stock rows, then locks them (SELECT … FOR UPDATE) ordered by branch and item.
  lockBalances(db: Db, pairs: { branchId: string; itemId: string }[]): Promise<LockedBalance[]>;
  insertLedger(db: Db, rows: LedgerInsert[]): Promise<void>;
  setOnHand(db: Db, branchId: string, itemId: string, onHandMilli: number): Promise<void>;
  // Adds (or with a negative delta removes) in-transit quantity at the receiving branch.
  addInTransit(db: Db, branchId: string, itemId: string, deltaMilli: number): Promise<void>;

  list(filter: StockListFilter): Promise<Paginated<StockRowDto>>;
  ledger(branchId: string, itemId: string, page: number, limit: number): Promise<Paginated<LedgerEntryDto>>;
  findStock(branchId: string, itemId: string): Promise<BranchStockRow | null>;
  upsertSettings(branchId: string, itemId: string, data: UpdateStockSettingsDto, db?: Db): Promise<BranchStockRow>;

  // Non-deleted items by id, for document lines.
  findLineItems(ids: string[]): Promise<LineItem[]>;
  // Item ids that already have ledger rows in the branch (opening stock is only posted once).
  itemsWithHistory(branchId: string, itemIds: string[]): Promise<Set<string>>;
  findBrandsByNames(names: string[]): Promise<{ id: string; name: string }[]>;
  findCategoriesByNames(names: string[]): Promise<{ id: string; name: string }[]>;
  createBrand(db: Db, name: string): Promise<{ id: string; name: string }>;
  createCategory(db: Db, name: string): Promise<{ id: string; name: string }>;
}
