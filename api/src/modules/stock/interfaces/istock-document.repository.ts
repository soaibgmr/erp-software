import type { StockAdjustmentStatus, StockTransferStatus } from "@erp-software/shared";
import type { Paginated } from "../../../common/pagination";
import type { Db } from "../../../common/prisma-types";
import type {
  CreateAdjustmentData,
  CreateTransferData,
  ListAdjustmentsQuery,
  ListTransfersQuery,
  StockAdjustmentDetailDto,
  StockAdjustmentDto,
  StockTransferDetailDto,
  StockTransferDto,
} from "../stock.types";

// Adjustment and transfer documents. Stock itself only changes through IStockService.post.
export interface IStockDocumentRepository {
  createAdjustment(db: Db, data: CreateAdjustmentData): Promise<{ id: string }>;
  findAdjustment(id: string, db?: Db): Promise<StockAdjustmentDetailDto | null>;
  listAdjustments(branchId: string, query: ListAdjustmentsQuery): Promise<Paginated<StockAdjustmentDto>>;
  // Moves PENDING to `to`; false when the adjustment was no longer pending (someone else decided first).
  decideAdjustment(
    db: Db,
    id: string,
    to: Exclude<StockAdjustmentStatus, "PENDING">,
    decidedById: string,
    note: string | null,
  ): Promise<boolean>;

  createTransfer(db: Db, data: CreateTransferData): Promise<{ id: string }>;
  findTransfer(id: string, db?: Db): Promise<StockTransferDetailDto | null>;
  // Transfers into or out of the branch.
  listTransfers(branchId: string, query: ListTransfersQuery): Promise<Paginated<StockTransferDto>>;
  // Moves IN_TRANSIT to `to`; false when it was already closed.
  closeTransfer(
    db: Db,
    id: string,
    to: Exclude<StockTransferStatus, "IN_TRANSIT">,
    closedById: string,
  ): Promise<boolean>;
}
