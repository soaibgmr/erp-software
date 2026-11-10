import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { DashboardRange, PaymentMethod, ReportResult, SalesGroupBy } from "@automobile/shared";
import { useAuth } from "@/app/auth";
import { api } from "@/lib/api-client";
import type { InvoiceSummary } from "@/lib/types";

// "branch" = the selected branch (x-branch-id); "all" = every branch the user can access.
export type BranchScopeOption = "branch" | "all";

const scopeParam = (scope: BranchScopeOption) => (scope === "all" ? "all" : undefined);
const useBranchId = () => useAuth().branch?.id ?? "none";

export interface DashboardSummary {
  range: DashboardRange;
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  scope: { branchIds: string[]; label: string };
  sales: { total: string; bills: number; average: string; previousTotal: string; changePercent: number | null };
  collected: { total: string; percentOfSales: number | null; byMode: { mode: PaymentMethod; amount: string }[] };
  receivables: { total: string; customers: number; overdue30: string; overdueCustomers: number };
}

export interface SalesTrend {
  scope: { branchIds: string[]; label: string };
  days: { date: string; bills: number; parts: string; labour: string; total: string }[];
}

export interface LowStock {
  scope: { branchIds: string[]; label: string };
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
    status: "IN_STOCK" | "LOW" | "OUT";
  }[];
}

export const reportKeys = {
  summary: (branchId: string, scope: BranchScopeOption, range: DashboardRange) =>
    ["dashboard", "summary", branchId, scope, range] as const,
  trend: (branchId: string, scope: BranchScopeOption) => ["dashboard", "trend", branchId, scope] as const,
  lowStock: (branchId: string, scope: BranchScopeOption) => ["dashboard", "low-stock", branchId, scope] as const,
  recent: (branchId: string, scope: BranchScopeOption) => ["invoices", "recent", branchId, scope] as const,
  report: (branchId: string, name: string, params: object) => ["reports", name, branchId, params] as const,
};

// Dashboard numbers move with every sale: refresh every minute while the page is open.
const live = { refetchInterval: 60_000, placeholderData: keepPreviousData };

export function useDashboardSummary(scope: BranchScopeOption, range: DashboardRange) {
  const branchId = useBranchId();
  return useQuery({
    queryKey: reportKeys.summary(branchId, scope, range),
    queryFn: ({ signal }) =>
      api.get<DashboardSummary>("/dashboard/summary", { range, branchId: scopeParam(scope) }, signal),
    ...live,
  });
}

export function useSalesTrend(scope: BranchScopeOption) {
  const branchId = useBranchId();
  return useQuery({
    queryKey: reportKeys.trend(branchId, scope),
    queryFn: ({ signal }) =>
      api.get<SalesTrend>("/dashboard/sales-trend", { days: 14, branchId: scopeParam(scope) }, signal),
    ...live,
  });
}

export function useLowStock(scope: BranchScopeOption, enabled: boolean) {
  const branchId = useBranchId();
  return useQuery({
    queryKey: reportKeys.lowStock(branchId, scope),
    queryFn: ({ signal }) =>
      api.get<LowStock>("/dashboard/low-stock", { limit: 6, branchId: scopeParam(scope) }, signal),
    enabled,
    ...live,
  });
}

export function useRecentInvoices(scope: BranchScopeOption, enabled: boolean) {
  const branchId = useBranchId();
  return useQuery({
    queryKey: reportKeys.recent(branchId, scope),
    queryFn: ({ signal }) =>
      api.list<InvoiceSummary>("/invoices", { page: 1, limit: 6, branchId: scopeParam(scope) }, signal),
    enabled,
    ...live,
  });
}

export interface ReportParams {
  from?: string;
  to?: string;
  scope: BranchScopeOption;
  groupBy?: SalesGroupBy;
}

const reportQuery = (p: ReportParams) => ({
  from: p.from,
  to: p.to,
  branchId: scopeParam(p.scope),
  groupBy: p.groupBy,
});

export function useReport(name: string, params: ReportParams) {
  const branchId = useBranchId();
  return useQuery({
    queryKey: reportKeys.report(branchId, name, params),
    queryFn: ({ signal }) => api.get<ReportResult>(`/reports/${name}`, reportQuery(params), signal),
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export const downloadReport = (name: string, params: ReportParams, format: "csv" | "xlsx" | "portal") =>
  api.download(`/reports/${name}`, { ...reportQuery(params), format });

export const downloadTally = (params: ReportParams, vouchers: string[]) =>
  api.download("/reports/tally-export", {
    from: params.from,
    to: params.to,
    branchId: scopeParam(params.scope),
    vouchers: vouchers.join(","),
  });
