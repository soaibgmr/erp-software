import { z } from "zod";
import { paginationQuery, searchQuery } from "../../common/schemas";

export {
  labourServiceCreateSchema as createLabourServiceSchema,
  labourServiceUpdateSchema as updateLabourServiceSchema,
} from "@erp-software/shared";

export const listLabourServicesQuerySchema = z.object({
  ...paginationQuery,
  search: searchQuery,
  isActive: z.stringbool().optional(),
});
