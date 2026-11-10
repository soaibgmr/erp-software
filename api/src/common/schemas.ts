import { z } from "zod";

export const idParamSchema = z.object({ id: z.uuid() });

export const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const searchQuery = z.string().trim().min(1).max(100).optional();
