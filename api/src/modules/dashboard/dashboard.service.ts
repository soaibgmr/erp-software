import { inject, injectable } from "inversify";
import { DASHBOARD_RANGE_DAYS, toPaise } from "@erp-software/shared";
import { TYPES } from "../../config/ioc.types";
import { env } from "../../config/env";
import type { AuthContext } from "../../common/auth-context";
import { resolveBranchScope } from "../../common/branch-scope";
import { startOfDayIn } from "../../utils/time";
import type { IBranchRepository } from "../branches/interfaces/ibranch.repository";
import { addDays, daysBetween, todayIn } from "../../common/date-only";
import type { IReportRepository } from "../reports/interfaces/ireport.repository";
import type { IStockService } from "../stock/interfaces/istock.service";
import type {
  DashboardSummaryDto,
  DashboardSummaryQuery,
  LowStockDto,
  LowStockQuery,
  SalesTrendDto,
  SalesTrendQuery,
} from "./dashboard.types";
import type { IDashboardRepository } from "./interfaces/idashboard.repository";
import type { IDashboardService } from "./interfaces/idashboard.service";

const money = (paise: number) => (paise / 100).toFixed(2);
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

@injectable()
export class DashboardService implements IDashboardService {
  constructor(
    @inject(TYPES.DashboardRepository) private readonly dashboard: IDashboardRepository,
    @inject(TYPES.ReportRepository) private readonly reports: IReportRepository,
    @inject(TYPES.BranchRepository) private readonly branches: IBranchRepository,
    @inject(TYPES.StockService) private readonly stock: IStockService,
  ) {}

  async summary(
    auth: AuthContext,
    currentBranchId: string | undefined,
    { range, branchId }: DashboardSummaryQuery,
  ): Promise<DashboardSummaryDto> {
    const scope = await resolveBranchScope(this.branches, auth, branchId, currentBranchId);
    const tz = env.APP_TIMEZONE;
    const today = todayIn(tz);
    const days = DASHBOARD_RANGE_DAYS[range];
    // "7 days" = today and the six days before it.
    const from = addDays(today, -(days - 1));
    const previousFrom = addDays(from, -days);
    const previousTo = addDays(from, -1);
    const at = (day: string) => startOfDayIn(day, tz);
    const start = at(from);
    const end = at(addDays(today, 1));
    const ids = scope.branchIds;

    const [sales, previous, collections, receivables] = ids.length
      ? await Promise.all([
          this.dashboard.salesTotals(ids, start, end),
          this.dashboard.salesTotals(ids, at(previousFrom), start),
          this.dashboard.collections(ids, start, end),
          this.reports.openInvoices(ids, tz),
        ])
      : [{ total: "0", bills: 0 }, { total: "0", bills: 0 }, [], []];

    const salesPaise = toPaise(sales.total);
    const previousPaise = toPaise(previous.total);
    const collectedPaise = collections.reduce((a, c) => a + toPaise(c.amount), 0);

    let receivable = 0;
    let overdue30 = 0;
    const customers = new Set<string>();
    const overdueCustomers = new Set<string>();
    for (const r of receivables) {
      const owed = toPaise(r.owed);
      const key = r.partyId ?? `name:${r.party}`;
      receivable += owed;
      customers.add(key);
      if (daysBetween(r.dueDate, today) > 30) {
        overdue30 += owed;
        overdueCustomers.add(key);
      }
    }

    return {
      range,
      from,
      to: today,
      previousFrom,
      previousTo,
      scope: { branchIds: ids, label: scope.label },
      sales: {
        total: money(salesPaise),
        bills: sales.bills,
        average: money(sales.bills ? Math.round(salesPaise / sales.bills) : 0),
        previousTotal: money(previousPaise),
        changePercent:
          previousPaise > 0 ? Math.round(((salesPaise - previousPaise) / previousPaise) * 1000) / 10 : null,
      },
      collected: {
        total: money(collectedPaise),
        percentOfSales: pct(collectedPaise, salesPaise),
        byMode: collections.map((c) => ({ mode: c.mode, amount: money(toPaise(c.amount)) })),
      },
      receivables: {
        total: money(receivable),
        customers: customers.size,
        overdue30: money(overdue30),
        overdueCustomers: overdueCustomers.size,
      },
    };
  }

  async salesTrend(
    auth: AuthContext,
    currentBranchId: string | undefined,
    { days, branchId }: SalesTrendQuery,
  ): Promise<SalesTrendDto> {
    const scope = await resolveBranchScope(this.branches, auth, branchId, currentBranchId);
    const tz = env.APP_TIMEZONE;
    const today = todayIn(tz);
    const from = addDays(today, -(days - 1));
    const rows = scope.branchIds.length
      ? await this.dashboard.salesTrend(
          scope.branchIds,
          startOfDayIn(from, tz),
          startOfDayIn(addDays(today, 1), tz),
          tz,
        )
      : [];
    const byDay = new Map(rows.map((r) => [r.day, r]));
    return {
      scope: { branchIds: scope.branchIds, label: scope.label },
      // Every day in the window, zeros included, oldest first.
      days: Array.from({ length: days }, (_, i) => {
        const date = addDays(from, i);
        const r = byDay.get(date);
        const parts = toPaise(r?.parts ?? "0");
        const labour = toPaise(r?.labour ?? "0");
        return { date, bills: r?.bills ?? 0, parts: money(parts), labour: money(labour), total: money(parts + labour) };
      }),
    };
  }

  async lowStock(
    auth: AuthContext,
    currentBranchId: string | undefined,
    { limit, branchId }: LowStockQuery,
  ): Promise<LowStockDto> {
    const scope = await resolveBranchScope(this.branches, auth, branchId, currentBranchId);
    const page = await this.stock.list(auth, currentBranchId, {
      branchId: branchId === "all" ? "all" : scope.branchIds[0],
      status: "LOW",
      sort: "available",
      page: 1,
      limit,
    });
    return {
      scope: { branchIds: scope.branchIds, label: scope.label },
      total: page.total,
      items: page.data.map((r) => ({
        itemId: r.itemId,
        sku: r.sku,
        name: r.name,
        unit: r.unit,
        branchId: r.branchId,
        branchCode: r.branchCode,
        available: r.available,
        minLevel: r.minLevel,
        reorderQty: r.reorderQty,
        status: r.status,
      })),
    };
  }
}
