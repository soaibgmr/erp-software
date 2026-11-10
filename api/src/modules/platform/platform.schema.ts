import { z } from "zod";
import { BUSINESS_STATUSES } from "@erp-software/shared";
import { paginationQuery, searchQuery } from "../../common/schemas";

export const listBusinessesQuerySchema = z.object({
  ...paginationQuery,
  status: z.enum(BUSINESS_STATUSES).optional(),
  search: searchQuery,
});
