import { z } from "zod";
import { STOCK_ADJUSTMENT_STATUSES, STOCK_TRANSFER_STATUSES } from "@erp-software/shared";
import { paginationQuery, searchQuery } from "../../common/schemas";

export {
  stockAdjustmentCreateSchema as createAdjustmentSchema,
  stockAdjustmentRejectSchema as rejectAdjustmentSchema,
  stockImportSchema as importSchema,
  stockSettingsSchema as updateStockSettingsSchema,
  stockTransferCreateSchema as createTransferSchema,
} from "@erp-software/shared";

export const listStockQuerySchema = z.object({
  ...paginationQuery,
  search: searchQuery,
  categoryId: z.uuid().optional(),
  brandId: z.uuid().optional(),
  status: z.enum(["IN_STOCK", "LOW", "OUT"]).optional(),
  // Defaults to the x-branch-id header; "all" lists every branch the user can access.
  branchId: z.union([z.uuid(), z.literal("all")]).optional(),
  sort: z.enum(["name", "sku", "available"]).default("name"),
});

export const itemIdParamSchema = z.object({ itemId: z.uuid() });

export const ledgerQuerySchema = z.object({
  ...paginationQuery,
  // Defaults to the x-branch-id header.
  branchId: z.uuid().optional(),
});

export const listAdjustmentsQuerySchema = z.object({
  ...paginationQuery,
  status: z.enum(STOCK_ADJUSTMENT_STATUSES).optional(),
});

export const listTransfersQuerySchema = z.object({
  ...paginationQuery,
  direction: z.enum(["all", "in", "out"]).default("all"),
  status: z.enum(STOCK_TRANSFER_STATUSES).optional(),
});
