import { z } from "zod";
import { paginationQuery } from "../../common/schemas";

export { shiftCloseSchema as closeShiftSchema, shiftOpenSchema as openShiftSchema } from "@erp-software/shared";

export const listShiftsQuerySchema = z.object({
  ...paginationQuery,
  status: z.enum(["OPEN", "CLOSED"]).optional(),
});
