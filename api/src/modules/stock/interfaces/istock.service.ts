import type { AuthContext } from "../../../common/auth-context";
import type { Paginated } from "../../../common/pagination";
import type { Db } from "../../../common/prisma-types";
import type { ItemStockDto } from "../../items/item.types";
import type {
  CreateStockAdjustmentDto,
  CreateStockTransferDto,
  ImportReport,
  LedgerEntryDto,
  LedgerQuery,
  ListAdjustmentsQuery,
  ListStockQuery,
  ListTransfersQuery,
  PostOptions,
  StockAdjustmentDetailDto,
  StockAdjustmentDto,
  StockMovement,
  StockRowDto,
  StockTransferDetailDto,
  StockTransferDto,
  UpdateStockSettingsDto,
} from "../stock.types";
import type { StockImportInput } from "@erp-software/shared";

export interface IStockService {
  // The only way on-hand quantity changes. Call inside the caller's transaction: locks the
  // branch_stock rows, blocks negative availability (unless allowed), writes ledger rows and balances.
  // Every query runs on `db`; never open another connection from inside it.
  post(db: Db, actor: { userId: string }, movements: StockMovement[], options: PostOptions): Promise<void>;
  // In-transit quantity at a receiving branch (transfers); doesn't touch on hand or the ledger.
  addInTransit(db: Db, branchId: string, lines: { itemId: string; quantity: number }[], sign: 1 | -1): Promise<void>;

  // Min level / reorder qty / bin inside a caller's transaction (import), without auditing each row.
  applySettings(db: Db, branchId: string, itemId: string, input: UpdateStockSettingsDto): Promise<void>;

  list(auth: AuthContext, currentBranchId: string | undefined, query: ListStockQuery): Promise<Paginated<StockRowDto>>;
  ledger(auth: AuthContext, itemId: string, branchId: string, query: LedgerQuery): Promise<Paginated<LedgerEntryDto>>;
  updateSettings(
    auth: AuthContext,
    branchId: string,
    itemId: string,
    input: UpdateStockSettingsDto,
  ): Promise<ItemStockDto>;
}

export interface IStockAdjustmentService {
  list(branchId: string, query: ListAdjustmentsQuery): Promise<Paginated<StockAdjustmentDto>>;
  getById(auth: AuthContext, id: string): Promise<StockAdjustmentDetailDto>;
  // Posts immediately unless the value is above the approval limit and the user can't approve.
  create(auth: AuthContext, branchId: string, input: CreateStockAdjustmentDto): Promise<StockAdjustmentDetailDto>;
  approve(auth: AuthContext, branchId: string, id: string): Promise<StockAdjustmentDetailDto>;
  reject(auth: AuthContext, branchId: string, id: string, note: string | null): Promise<StockAdjustmentDetailDto>;
}

export interface IStockTransferService {
  list(branchId: string, query: ListTransfersQuery): Promise<Paginated<StockTransferDto>>;
  getById(auth: AuthContext, id: string): Promise<StockTransferDetailDto>;
  // Dispatch from `fromBranchId`: stock leaves now and shows as in transit at the receiver.
  create(auth: AuthContext, fromBranchId: string, input: CreateStockTransferDto): Promise<StockTransferDetailDto>;
  receive(auth: AuthContext, branchId: string, id: string): Promise<StockTransferDetailDto>;
  // Only the sending branch; stock returns to it.
  cancel(auth: AuthContext, branchId: string, id: string): Promise<StockTransferDetailDto>;
}

export interface IStockImportService {
  // Validates every row; with commit=true and no errors, writes items and opening stock in one transaction.
  run(auth: AuthContext, branchId: string, input: StockImportInput): Promise<ImportReport>;
}
