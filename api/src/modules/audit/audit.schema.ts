import { z } from "zod";
import { paginationQuery } from "../../common/schemas";

export const listAuditLogsQuerySchema = z.object({
  ...paginationQuery,
  entity: z.string().trim().max(60).optional(),
  entityId: z.string().trim().max(64).optional(),
  actorId: z.uuid().optional(),
  action: z.string().trim().max(60).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
