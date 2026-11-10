import { Link, useParams } from "react-router";
import { Printer } from "lucide-react";
import { formatINR, PAYMENT_METHOD_LABELS } from "@automobile/shared";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, KpiCard } from "@/components/ui/Card";
import { DescriptionList, PageHeader } from "@/components/ui/Controls";
import { ErrorBanner, Skeleton } from "@/components/ui/States";
import { cn, errorMessage, formatDateTime } from "@/lib/utils";
import { useShiftReport } from "../api";

const inr = (v: string | number) => formatINR(v, { exact: true });

// Expected vs counted per payment method (PRD M5.11). Prints as-is: app chrome is hidden in print.
export function ShiftReportPage() {
  const { id } = useParams();
  const query = useShiftReport(id);

  if (query.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }
  if (query.error || !query.data) {
    return (
      <ErrorBanner
        title="Couldn't load this shift"
        message={errorMessage(query.error)}
        onRetry={() => query.refetch()}
      />
    );
  }
  const s = query.data;
  const closed = s.status === "CLOSED";
  // Methods with nothing expected or counted are noise on the report.
  const methods = s.methods.filter(
    (m) => Number(m.expected) !== 0 || Number(m.counted ?? 0) !== 0 || m.mode === "CASH",
  );
  const totalVariance = methods.reduce((sum, m) => sum + Number(m.variance ?? 0), 0);

  return (
    <>
      {/* Print just the report: hide the sidebar and top bar, drop the sidebar gutter. */}
      <style>
        {
          "@media print { aside, header.sticky { display: none !important; } div:has(> aside) { padding-left: 0 !important; } main { padding: 0 !important; } }"
        }
      </style>
      <PageHeader
        breadcrumb={
          <span className="print:hidden">
            <Link to="/invoices" className="hover:text-navy-700">
              Invoices
            </Link>{" "}
            /{" "}
            <Link to="/invoices/shifts" className="hover:text-navy-700">
              Shifts
            </Link>{" "}
            / {s.counter}
          </span>
        }
        title={`Shift report · ${s.counter}`}
        badge={closed ? <Badge>Closed</Badge> : <Badge tone="info">Open</Badge>}
        description={`${s.user?.name ?? "—"} · ${formatDateTime(s.openedAt)}${closed ? ` – ${formatDateTime(s.closedAt)}` : ""}`}
        actions={
          <Button
            variant="outline"
            icon={<Printer className="size-4" />}
            onClick={() => window.print()}
            className="print:hidden"
          >
            Print
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Invoices" value={s.invoiceCount} />
        <KpiCard label="Sales" value={formatINR(s.salesTotal)} />
        <KpiCard label="Dues (pay later)" value={formatINR(s.creditTotal)} />
        <KpiCard label="Cancelled" value={s.cancelledCount} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader
            title="Cash & payments"
            subtitle={
              closed
                ? "Counted at close against what the shift's payments add up to."
                : "Running totals; counted amounts are entered when the shift closes."
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b border-border">
                  <th className="eyebrow h-11 px-6 text-left font-semibold text-slate">Method</th>
                  <th className="eyebrow h-11 px-6 text-right font-semibold text-slate">Expected</th>
                  <th className="eyebrow h-11 px-6 text-right font-semibold text-slate">Counted</th>
                  <th className="eyebrow h-11 px-6 text-right font-semibold text-slate">Variance</th>
                </tr>
              </thead>
              <tbody>
                {methods.map((m) => {
                  const v = m.variance == null ? null : Number(m.variance);
                  return (
                    <tr key={m.mode} className="border-b border-border last:border-0">
                      <td className="h-12 px-6 font-medium text-ink">
                        {PAYMENT_METHOD_LABELS[m.mode]}
                        {m.mode === "CASH" && (
                          <span className="block text-helper font-normal text-slate">
                            incl. opening {inr(s.openingCash)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 text-right tabular">{inr(m.expected)}</td>
                      <td className="px-6 text-right tabular">{m.counted == null ? "—" : inr(m.counted)}</td>
                      <td
                        className={cn(
                          "px-6 text-right font-semibold tabular",
                          v == null ? "text-slate" : v < 0 ? "text-danger" : v === 0 ? "text-success" : "text-warning",
                        )}
                      >
                        {v == null ? "—" : `${v > 0 ? "+" : ""}${inr(v)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {closed && (
                <tfoot>
                  <tr className="border-t border-border">
                    <td className="h-12 px-6 font-semibold text-ink" colSpan={3}>
                      Total variance
                    </td>
                    <td
                      className={cn(
                        "px-6 text-right font-bold tabular",
                        totalVariance < 0 ? "text-danger" : totalVariance === 0 ? "text-success" : "text-warning",
                      )}
                    >
                      {`${totalVariance > 0 ? "+" : ""}${inr(totalVariance)}`}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Shift" />
          <CardBody>
            <DescriptionList
              items={[
                { label: "Counter", value: s.counter },
                { label: "Cashier", value: s.user?.name },
                { label: "Opening cash", value: inr(s.openingCash) },
                { label: "Opened", value: formatDateTime(s.openedAt) },
                { label: "Closed", value: closed ? formatDateTime(s.closedAt) : "Still open" },
                { label: "Close note", value: s.closeNote },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
