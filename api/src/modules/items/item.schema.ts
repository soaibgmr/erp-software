import { z } from "zod";
import { paginationQuery, searchQuery } from "../../common/schemas";

export { itemCreateSchema as createItemSchema, itemUpdateSchema as updateItemSchema } from "@erp-software/shared";

export const listItemsQuerySchema = z.object({
  ...paginationQuery,
  search: searchQuery,
  categoryId: z.uuid().optional(),
  brandId: z.uuid().optional(),
  isActive: z.stringbool().optional(),
  sort: z.enum(["name", "sku", "recent"]).default("name"),
});

export const searchItemsQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const codeParamSchema = z.object({ code: z.string().trim().min(1).max(64) });
