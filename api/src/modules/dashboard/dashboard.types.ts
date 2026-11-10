import type { DashboardRange, PaymentMethod } from "@erp-software/shared";

export interface DashboardScopeDto {
  branchIds: string[];
  label: string;
}

export interface DashboardSummaryDto {
  range: DashboardRange;
  // Inclusive days in the app timezone; previous* is the period of the same length just before.
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  scope: DashboardScopeDto;
  sales: {
    total: string;
    bills: number;
    average: string;
    previousTotal: string;
    // null when the previous period had no sales.
    changePercent: number | null;
  };
  collected: {
    // Net of refunds and reversals, by when the money moved (not the invoice date).
    total: string;
    percentOfSales: number | null;
    byMode: { mode: PaymentMethod | string; amount: string }[];
  };
  receivables: {
    total: string;
    customers: number;
    // Owed more than 30 days past the due date.
    overdue30: string;
    overdueCustomers: number;
  };
}

export interface SalesTrendDayDto {
  date: string;
  bills: number;
  parts: string;
  labour: string;
  // parts + labour (line totals incl. GST, before round-off).
  total: string;
}

export interface SalesTrendDto {
  scope: DashboardScopeDto;
  days: SalesTrendDayDto[];
}

export interface LowStockDto {
  scope: DashboardScopeDto;
  // Items at or below their minimum level (out of stock included).
  total: number;
  items: {
    itemId: string;
    sku: string;
    name: string;
    unit: string;
    branchId: string;
    branchCode: string;
    available: string;
    minLevel: string;
    reorderQty: string;
    status: string;
  }[];
}

export interface DashboardSummaryQuery {
  range: DashboardRange;
  branchId?: string;
}

export interface SalesTrendQuery {
  days: number;
  branchId?: string;
}

export interface LowStockQuery {
  limit: number;
  branchId?: string;
}
