import { z } from "zod";
import { CUSTOMER_TYPES, customerCreateSchema, customerUpdateSchema, mobileSchema } from "@erp-software/shared";
import { paginationQuery, searchQuery } from "../../common/schemas";

export { customerCreateSchema as createCustomerSchema, customerUpdateSchema as updateCustomerSchema };

export const listCustomersQuerySchema = z.object({
  ...paginationQuery,
  search: searchQuery,
  type: z.enum(CUSTOMER_TYPES).optional(),
  sort: z.enum(["name", "recent"]).default("recent"),
});

export const lookupCustomerQuerySchema = z.object({ mobile: mobileSchema });
