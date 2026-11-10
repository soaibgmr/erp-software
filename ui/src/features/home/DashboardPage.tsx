import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Download, FileText, Package, Users } from "lucide-react";
import {
  DASHBOARD_RANGE_LABELS,
  DASHBOARD_RANGES,
  formatINR,
  formatQty,
  PAYMENT_METHOD_LABELS,
  type DashboardRange,
} from "@automobile/shared";
import { useAuth } from "@/app/auth";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, KpiCard } from "@/components/ui/Card";
import { PageHeader, SegmentedControl } from "@/components/ui/Controls";
import { EmptyState, ErrorBanner, Skeleton, TableSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { InvoiceStatusBadge } from "@/features/invoices/components/common";
import {
  downloadReport,
  useDashboardSummary,
  useLowStock,
  useRecentInvoices,
  useSalesTrend,
  type BranchScopeOption,
  type DashboardSummary,
} from "@/features/reports/api";
import { SalesChart } from "@/features/reports/SalesChart";
import { cn, errorMessage, formatLongDate } from "@/lib/utils";

const inr = (v: string | number) => formatINR(v);
const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

// PRD M9: KPI cards, 14-day sales, recent invoices and low stock for a branch or all branches.
export function DashboardPage() {
  const { can } = useAuth();
  return can("dashboard.view") ? <Dashboard /> : <Welcome />;
}

function Dashboard() {
  const { me, branch, can } = useAuth();
  const toast = useToast();
  const [range, setRange] = useState<DashboardRange>("today");
  const [scope, setScope] = useState<BranchScopeOption>("branch");
  const [exporting, setExporting] = useState(false);
  const multiBranch = (me?.branches.length ?? 0) > 1;
  const canInvoices = can("invoice.view", "invoice.create");
  const canStock = can("inventory.view", "inventory.manage");

  const summary = useDashboardSummary(scope, range);
  const trend = useSalesTrend(scope);
  const lowStock = useLowStock(scope, canStock);
  const recent = useRecentInvoices(scope, canInvoices);

  const exportRange = async () => {
    if (!summary.data) return;
    setExporting(true);
    try {
      const name = await downloadReport(
        "sales-register",
        { from: summary.data.from, to: summary.data.to, scope },
        "xlsx",
      );
      toast({ message: `${name} downloaded` });
    } catch (err) {
      toast({ message: errorMessage(err), tone: "error" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${formatLongDate()} · ${scope === "all" ? "All branches" : (branch?.name ?? "")}`}
        actions={
          <>
            {multiBranch && (
              <SegmentedControl<BranchScopeOption>
                label="Branches"
                value={scope}
                onChange={setScope}
                options={[
                  { value: "branch", label: "This branch" },
                  { value: "all", label: "All branches" },
                ]}
              />
            )}
            <SegmentedControl<DashboardRange>
              label="Period"
              value={range}
              onChange={setRange}
              options={DASHBOARD_RANGES.map((r) => ({ value: r, label: DASHBOARD_RANGE_LABELS[r] }))}
            />
            {can("report.view") && (
              <Button
                variant="outline"
                onClick={exportRange}
                loading={exporting}
                disabled={!summary.data}
                icon={<Download className="size-4" />}
              >
                Export
              </Button>
            )}
          </>
        }
      />

      {summary.error && !summary.data ? (
        <ErrorBanner
          title="Couldn't load the dashboard"
          message={errorMessage(summary.error)}
          onRetry={() => summary.refetch()}
          className="mb-6"
        />
      ) : (
        <Kpis data={summary.data} range={range} />
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card>
          <CardHeader
            title="Sales, last 14 days"
            subtitle="Line totals including GST"
            actions={
              <div className="flex items-center gap-4 text-helper text-slate">
                <Legend className="bg-navy-700" label="Parts" />
                <Legend className="bg-yellow-500" label="Labour" />
              </div>
            }
          />
          <div className="px-6 py-5">
            {trend.isPending ? (
              <Skeleton className="h-56 w-full" />
            ) : trend.error || !trend.data ? (
              <ErrorBanner
                title="Couldn't load sales"
                message={errorMessage(trend.error)}
                onRetry={() => trend.refetch()}
              />
            ) : (
              <SalesChart days={trend.data.days} />
            )}
          </div>
        </Card>

        {canStock && (
          <Card>
            <CardHeader
              title="Low stock"
              subtitle={
                lowStock.data
                  ? `${lowStock.data.total} item${lowStock.data.total === 1 ? "" : "s"} at or below minimum`
                  : undefined
              }
              actions={
                <Link to="/inventory?status=LOW" className="text-helper font-medium text-navy-600 hover:underline">
                  View all
                </Link>
              }
            />
            <LowStockList query={lowStock} showBranch={scope === "all"} />
          </Card>
        )}
      </div>

      {canInvoices && (
        <Card className="mt-6">
          <CardHeader
            title="Recent invoices"
            actions={
              <Link to="/invoices" className="text-helper font-medium text-navy-600 hover:underline">
                All invoices
              </Link>
            }
          />
          <RecentInvoices query={recent} showBranch={scope === "all"} />
        </Card>
      )}
    </>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-[2px]", className)} aria-hidden />
      {label}
    </span>
  );
}

const periodWord: Record<DashboardRange, string> = {
  today: "yesterday",
  "7d": "previous 7 days",
  "30d": "previous 30 days",
};

function Kpis({ data, range }: { data: DashboardSummary | undefined; range: DashboardRange }) {
  const cols = "xl:grid-cols-3";
  if (!data) {
    return (
      <div className={cn("grid gap-4 sm:grid-cols-2", cols)}>
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i} className="px-5 py-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-8 w-32" />
            <Skeleton className="mt-2 h-3 w-40" />
          </Card>
        ))}
      </div>
    );
  }
  const { sales, collected, receivables } = data;
  const change = sales.changePercent;
  const modes = collected.byMode.filter((m) => Number(m.amount) !== 0).slice(0, 2);
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", cols)}>
      <KpiCard
        label={range === "today" ? "Today’s sales" : `Sales, ${DASHBOARD_RANGE_LABELS[range].toLowerCase()}`}
        value={inr(sales.total)}
        badge={
          change != null && (
            <Badge tone={change >= 0 ? "success" : "danger"} dot={false}>
              {change >= 0 ? "+" : ""}
              {change}%
            </Badge>
          )
        }
        sub={
          <>
            {sales.bills} bill{sales.bills === 1 ? "" : "s"} · avg {inr(sales.average)}
            <span className="block">
              {inr(sales.previousTotal)} {periodWord[range]}
            </span>
          </>
        }
      />
      <KpiCard
        label="Collected"
        value={inr(collected.total)}
        badge={
          collected.percentOfSales != null && (
            <Badge tone="info" dot={false}>
              {collected.percentOfSales}% of sales
            </Badge>
          )
        }
        sub={
          modes.length
            ? modes.map((m) => `${PAYMENT_METHOD_LABELS[m.mode] ?? m.mode} ${inr(m.amount)}`).join(" · ")
            : "No payments yet"
        }
      />
      <KpiCard
        label="Receivables"
        value={inr(receivables.total)}
        badge={Number(receivables.overdue30) > 0 && <Badge tone="danger">{receivables.overdueCustomers} overdue</Badge>}
        sub={
          <>
            {receivables.customers} {receivables.customers === 1 ? "party" : "parties"}
            {Number(receivables.overdue30) > 0 && ` · ${inr(receivables.overdue30)} over 30 days`}
          </>
        }
      />
    </div>
  );
}

function LowStockList({ query, showBranch }: { query: ReturnType<typeof useLowStock>; showBranch: boolean }) {
  if (query.isPending) return <TableSkeleton rows={4} columns={2} />;
  if (query.error || !query.data)
    return (
      <div className="p-5">
        <ErrorBanner
          title="Couldn't load low stock"
          message={errorMessage(query.error)}
          onRetry={() => query.refetch()}
        />
      </div>
    );
  if (!query.data.items.length)
    return (
      <EmptyState icon={Package} title="Stock is healthy" description="No item is at or below its minimum level." />
    );
  return (
    <ul className="divide-y divide-border">
      {query.data.items.map((i) => (
        <li key={`${i.branchId}-${i.itemId}`}>
          <Link to={`/inventory/items/${i.itemId}`} className="flex items-center gap-3 px-6 py-3 hover:bg-navy-50">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-ink">{i.name}</span>
              <span className="block text-helper text-slate">
                {i.sku}
                {showBranch && ` · ${i.branchCode}`}
              </span>
            </span>
            <span className="text-right">
              <span
                className={cn("block font-semibold tabular", Number(i.available) <= 0 ? "text-danger" : "text-warning")}
              >
                {formatQty(i.available)} {i.unit.toLowerCase()}
              </span>
              <span className="block text-helper text-slate tabular">min {formatQty(i.minLevel)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RecentInvoices({ query, showBranch }: { query: ReturnType<typeof useRecentInvoices>; showBranch: boolean }) {
  const [today] = useState(() => new Date().toDateString());
  if (query.isPending) return <TableSkeleton rows={4} columns={5} />;
  if (query.error || !query.data)
    return (
      <div className="p-5">
        <ErrorBanner
          title="Couldn't load invoices"
          message={errorMessage(query.error)}
          onRetry={() => query.refetch()}
        />
      </div>
    );
  if (!query.data.data.length)
    return <EmptyState icon={FileText} title="No invoices yet" description="Bills from the POS show up here." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-body">
        <tbody>
          {query.data.data.map((inv) => {
            const d = new Date(inv.invoiceDate);
            return (
              <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-navy-50">
                <td className="px-6 py-3">
                  <Link to={`/invoices/${inv.id}`} className="font-medium text-navy-700 hover:underline">
                    {inv.number}
                  </Link>
                  <p className="text-helper text-slate">
                    {d.toDateString() === today ? timeFmt.format(d) : `${dayFmt.format(d)}, ${timeFmt.format(d)}`}
                    {showBranch && ` · ${inv.branch.code}`}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-ink">{inv.customerName ?? "Walk-in"}</p>
                  <p className="text-helper text-slate">
                    {inv.itemCount} item{inv.itemCount === 1 ? "" : "s"}
                    {inv.paymentModes.length > 0 &&
                      ` · ${inv.paymentModes.map((m) => PAYMENT_METHOD_LABELS[m]).join(", ")}`}
                  </p>
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular">
                  {formatINR(inv.grandTotal, { exact: true })}
                </td>
                <td className="px-6 py-3 text-right">
                  <InvoiceStatusBadge status={inv.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Shown at "/" to users without the dashboard permission (e.g. Storekeeper).
function Welcome() {
  const { me, branch, can } = useAuth();
  const shortcuts = [
    can("inventory.view", "inventory.manage") && {
      to: "/inventory",
      label: "Inventory",
      description: "Stock levels, adjustments, transfers",
      icon: Package,
    },
    can("customer.view", "customer.manage") && {
      to: "/customers",
      label: "Customers",
      description: "Add and find customers",
      icon: Users,
    },
  ].filter(Boolean) as { to: string; label: string; description: string; icon: typeof Users }[];

  return (
    <>
      <PageHeader
        title={`Welcome, ${me?.user.firstName ?? ""}`}
        description={`${formatLongDate()} · ${branch?.name ?? ""}`}
      />
      <Card className="max-w-xl">
        <CardHeader title="Go to" />
        {shortcuts.length ? (
          <ul className="p-2">
            {shortcuts.map((s) => (
              <li key={s.to}>
                <Link to={s.to} className="flex items-center gap-3 rounded-input px-3 py-3 hover:bg-navy-50">
                  <s.icon className="size-[18px] text-navy-700" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink">{s.label}</span>
                    <span className="block text-helper text-slate">{s.description}</span>
                  </span>
                  <ArrowRight className="size-4 text-slate" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Users}
            title="Nothing to show yet"
            description="Ask an admin to give your role access to a module."
          />
        )}
      </Card>
    </>
  );
}
