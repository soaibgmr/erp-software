import { operation, type Paths, queryParams, ref, success } from "../../docs/openapi.helpers";
import { dashboardSummaryQuerySchema, lowStockQuerySchema, salesTrendQuerySchema } from "./dashboard.schema";

const money = { type: "string", example: "24856.00" };
const day = { type: "string", format: "date" };
const scope = {
  type: "object",
  properties: { branchIds: { type: "array", items: { type: "string" } }, label: { type: "string" } },
};

export const dashboardSchemas = {
  DashboardSummary: {
    type: "object",
    properties: {
      range: { type: "string", enum: ["today", "7d", "30d"] },
      from: day,
      to: day,
      previousFrom: day,
      previousTo: day,
      scope,
      sales: {
        type: "object",
        properties: {
          total: money,
          bills: { type: "integer" },
          average: money,
          previousTotal: money,
          changePercent: { type: ["number", "null"] },
        },
      },
      collected: {
        type: "object",
        properties: {
          total: money,
          percentOfSales: { type: ["number", "null"] },
          byMode: { type: "array", items: { type: "object", properties: { mode: { type: "string" }, amount: money } } },
        },
      },
      receivables: {
        type: "object",
        properties: {
          total: money,
          customers: { type: "integer" },
          overdue30: money,
          overdueCustomers: { type: "integer" },
        },
      },
    },
  },
  SalesTrend: {
    type: "object",
    properties: {
      scope,
      days: {
        type: "array",
        items: {
          type: "object",
          properties: { date: day, bills: { type: "integer" }, parts: money, labour: money, total: money },
        },
      },
    },
  },
  DashboardLowStock: {
    type: "object",
    properties: {
      scope,
      total: { type: "integer" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            itemId: { type: "string" },
            sku: { type: "string" },
            name: { type: "string" },
            unit: { type: "string" },
            branchId: { type: "string" },
            branchCode: { type: "string" },
            available: { type: "string" },
            minLevel: { type: "string" },
            reorderQty: { type: "string" },
            status: { type: "string" },
          },
        },
      },
    },
  },
};

const branchNote = "`branchId` defaults to the `x-branch-id` header; `all` = every branch you can access.";

export const dashboardPaths: Paths = {
  "/api/v1/dashboard/summary": {
    get: operation({
      tag: "Dashboard",
      summary: "KPI cards",
      description:
        "Sales, collections and receivables (customers' dues). `range=7d` = today and the 6 days before; the change is against the 7 days before that. " +
        branchNote,
      parameters: queryParams(dashboardSummaryQuerySchema),
      responses: { 200: success("Summary", ref("DashboardSummary")) },
    }),
  },
  "/api/v1/dashboard/sales-trend": {
    get: operation({
      tag: "Dashboard",
      summary: "Daily sales, parts vs labour",
      description: "One entry per day (zeros included), oldest first. " + branchNote,
      parameters: queryParams(salesTrendQuerySchema),
      responses: { 200: success("Trend", ref("SalesTrend")) },
    }),
  },
  "/api/v1/dashboard/low-stock": {
    get: operation({
      tag: "Dashboard",
      summary: "Items at or below minimum level",
      description: "Lowest available first. " + branchNote,
      parameters: queryParams(lowStockQuerySchema),
      responses: { 200: success("Low stock", ref("DashboardLowStock")) },
    }),
  },
};
