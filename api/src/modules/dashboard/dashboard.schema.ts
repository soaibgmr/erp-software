import { z } from "zod";
import { DASHBOARD_RANGES } from "@automobile/shared";

// branchId defaults to the x-branch-id header; "all" = every branch the user can access.
const branchId = z.union([z.uuid(), z.literal("all")]).optional();

export const dashboardSummaryQuerySchema = z.object({
  range: z.enum(DASHBOARD_RANGES).default("today"),
  branchId,
});

export const salesTrendQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(14),
  branchId,
});

export const lowStockQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(8),
  branchId,
});
