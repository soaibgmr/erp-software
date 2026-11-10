import { Link, useParams } from "react-router";
import { Printer } from "lucide-react";
import { formatINR, formatQty } from "@erp-software/shared";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DescriptionList, PageHeader } from "@/components/ui/Controls";
import { ErrorBanner, Skeleton } from "@/components/ui/States";
import { cn, errorMessage, formatDateTime } from "@/lib/utils";
import { useCreditNote } from "../api";

const money = (v: string | number) => formatINR(v, { exact: true });
const th = "eyebrow h-11 px-4 font-semibold whitespace-nowrap text-slate";

export function CreditNoteDetailPage() {
  const { id } = useParams();
  const query = useCreditNote(id);

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
        title="Couldn't load this credit note"
        message={errorMessage(query.error)}
        onRetry={() => query.refetch()}
      />
    );
  }
  const c = query.data;
  const igst = Number(c.igstTotal) > 0;

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <Link to="/invoices/credit-notes" className="hover:text-navy-700">
              Credit notes
            </Link>{" "}
            / {c.number}
          </>
        }
        title={c.number}
        description={`${formatDateTime(c.createdAt)}${c.createdBy ? ` · ${c.createdBy.name}` : ""}`}
        actions={
          <Button
            variant="outline"
            icon={<Printer className="size-4" />}
            onClick={() => window.open(`/print/credit-note/${c.id}`, "_blank", "noopener")}
          >
            Print
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Details" />
            <CardBody>
              <DescriptionList
                items={[
                  {
                    label: "Against invoice",
                    value: (
                      <Link
                        to={`/invoices/${c.invoice.id}`}
                        className="font-mono font-medium text-navy-700 hover:underline"
                      >
                        {c.invoice.number}
                      </Link>
                    ),
                  },
                  { label: "Customer", value: c.invoice.customerName ?? "Walk-in customer" },
                  { label: "Reason", value: c.reason },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Returned items" />
            <div className="overflow-x-auto">
              <table className="w-full text-body">
                <thead>
                  <tr className="border-b border-border bg-navy-50">
                    <th className={cn(th, "text-left")}>Item</th>
                    <th className={cn(th, "text-left")}>HSN/SAC</th>
                    <th className={cn(th, "text-right")}>Qty</th>
                    <th className={cn(th, "text-right")}>Rate</th>
                    <th className={cn(th, "text-right")}>Taxable</th>
                    <th className={cn(th, "text-right")}>GST</th>
                    <th className={cn(th, "text-right")}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {c.lines.map((l) => (
                    <tr key={l.invoiceLineId} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{l.description}</p>
                        {l.sku && <p className="font-mono text-helper text-slate">{l.sku}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate">{l.hsnSac ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular">{formatQty(l.quantity)}</td>
                      <td className="px-4 py-3 text-right tabular">{money(l.rate)}</td>
                      <td className="px-4 py-3 text-right tabular">{money(l.taxable)}</td>
                      <td className="px-4 py-3 text-right tabular">
                        {l.gstRate}%
                        <p className="text-helper text-slate">
                          {money(Number(l.cgst) + Number(l.sgst) + Number(l.igst))}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular">{money(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="Totals" />
          <CardBody className="space-y-2 text-body">
            <Row label="Taxable value" value={money(c.taxableTotal)} />
            {igst ? (
              <Row label="IGST" value={money(c.igstTotal)} />
            ) : (
              <>
                <Row label="CGST" value={money(c.cgstTotal)} />
                <Row label="SGST" value={money(c.sgstTotal)} />
              </>
            )}
            {Number(c.roundOff) !== 0 && <Row label="Round off" value={money(c.roundOff)} />}
            <div className="flex items-baseline justify-between border-t border-border pt-3">
              <span className="font-semibold text-ink">Credit total</span>
              <span className="text-section font-bold text-ink tabular">{money(c.total)}</span>
            </div>
            <Row label="Refunded to customer" value={Number(c.refunded) > 0 ? money(c.refunded) : "None"} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-slate">{label}</span>
      <span className="text-ink tabular">{value}</span>
    </div>
  );
}
