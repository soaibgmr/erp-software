import { z } from "zod";
import { branchCreateSchema, branchUpdateSchema } from "@automobile/shared";
import { searchQuery } from "../../common/schemas";

export { branchCreateSchema as createBranchSchema, branchUpdateSchema as updateBranchSchema };

export const listBranchesQuerySchema = z.object({
  includeInactive: z.stringbool().default(false),
  search: searchQuery,
});
