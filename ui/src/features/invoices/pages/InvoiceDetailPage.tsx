import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ChevronDown, Printer, Undo2 } from "lucide-react";
import { formatINR, formatMobile, formatQty, PAYMENT_METHOD_LABELS, stateName } from "@automobile/shared";
import { useAuth } from "@/app/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DescriptionList, PageHeader } from "@/components/ui/Controls";
import { Menu } from "@/components/ui/Menu";
import { EmptyState, ErrorBanner, Skeleton } from "@/components/ui/States";
import type { InvoiceDetail, Payment } from "@/lib/types";
import { cn, errorMessage, formatDate, formatDateTime } from "@/lib/utils";
import { useSettings } from "@/features/settings/api";
import { useInvoice } from "../api";
import { CancelInvoiceDialog } from "../components/CancelInvoiceDialog";
import { InvoiceStatusBadge, printMenuItems } from "../components/common";
import { CollectPaymentDialog, ReversePaymentDialog } from "../components/PaymentDialogs";

const money = (v: string | number) => formatINR(v, { exact: true });

export function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const query = useInvoice(id);
  const settings = useSettings();
  const [collecting, setCollecting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reversing, setReversing] = useState<Payment | null>(null);

  if (query.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72 w-full rounded-card" />
      </div>
    );
  }
  if (query.error || !query.data) {
    return (
      <ErrorBanner
        title="Couldn't load this invoice"
        message={errorMessage(query.error)}
        onRetry={() => query.refetch()}
      />
    );
  }
  const inv = query.data;
  const cancelled = inv.status === "CANCELLED";
  const due = Number(inv.balanceDue);
  const hasCreditNotes = inv.creditNotes.length > 0;
  // A customer's old dues: no items, no tax, nothing to print or return.
  const oldDues = inv.kind === "OPENING_BALANCE";

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <Link to="/invoices" className="hover:text-navy-700">
              Invoices
            </Link>{" "}
            / {inv.number}
          </>
        }
        title={inv.number}
        badge={<InvoiceStatusBadge status={inv.status} />}
        description={
          oldDues
            ? `Old dues · owed since ${formatDate(inv.invoiceDate)} · ${inv.branch.name}`
            : `${formatDateTime(inv.invoiceDate)} · ${inv.branch.name}`
        }
        actions={
          <>
            {!oldDues && (
              <Menu
                align="right"
                label="Print"
                trigger={(p) => (
                  <Button variant="outline" icon={<Printer className="size-4" />} {...p}>
                    Print <ChevronDown className="size-4" />
                  </Button>
                )}
                items={printMenuItems(inv.id, settings.data?.print.defaultFormat)}
              />
            )}
            {!cancelled && !oldDues && can("invoice.cancel") && (
              <Button
                variant="outline"
                icon={<Undo2 className="size-4" />}
                onClick={() => navigate(`/invoices/${inv.id}/credit-note`)}
              >
                Credit note
              </Button>
            )}
            {!cancelled && due > 0 && can("invoice.create") && (
              <Button variant="accent" onClick={() => setCollecting(true)}>
                Collect {money(due)}
              </Button>
            )}
            {!cancelled && can("invoice.cancel") && (
              <Menu
                items={[
                  {
                    label: oldDues
                      ? "Cancel old dues"
                      : hasCreditNotes
                        ? "Cancel invoice (has credit notes)"
                        : "Cancel invoice",
                    destructive: true,
                    disabled: hasCreditNotes,
                    onSelect: () => setCancelling(true),
                  },
                ]}
              />
            )}
          </>
        }
      />

      {cancelled && (
        <div role="status" className="mb-6 rounded-card border border-border bg-canvas px-4 py-3 text-body text-slate">
          Cancelled {formatDateTime(inv.cancelledAt)}
          {inv.cancelledBy && ` by ${inv.cancelledBy.name}`}
          {inv.cancelReason && <> · “{inv.cancelReason}”</>}.
          {oldDues ? " These old dues no longer count." : " Stock was returned and payments refunded."}
        </div>
      )}
      {!cancelled && hasCreditNotes && can("invoice.cancel") && (
        <p className="mb-4 text-helper text-slate">
          This invoice has credit notes, so it can't be cancelled. Return the remaining items with another credit note
          instead.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Bill to" />
            <CardBody>
              <DescriptionList
                items={[
                  {
                    label: "Customer",
                    value: inv.customerId ? (
                      <Link to={`/customers/${inv.customerId}`} className="font-medium text-navy-700 hover:underline">
                        {inv.customerName}
                      </Link>
                    ) : (
                      "Walk-in customer"
                    ),
                  },
                  { label: "Mobile", value: inv.customerMobile ? formatMobile(inv.customerMobile) : null },
                  { label: "GSTIN", value: inv.customerGstin },
                  { label: "Address", value: inv.customerAddress },
                  ...(oldDues
                    ? []
                    : [
                        {
                          label: "Place of supply",
                          value: `${inv.placeOfSupply} · ${stateName(inv.placeOfSupply) ?? ""} — ${
                            inv.supplyType === "INTRA_STATE" ? "Intra-state (CGST + SGST)" : "Inter-state (IGST)"
                          }`,
                        },
                      ]),
                  { label: "Due date", value: inv.dueDate ? formatDate(inv.dueDate) : "Paid at the counter" },
                ]}
              />
            </CardBody>
          </Card>

          {oldDues ? (
            <Card>
              <CardBody className="text-body text-slate">
                Old dues the customer owed before this software was used. There are no items or tax; collect it like any
                bill. To fix a wrong amount, reverse any payments, cancel these old dues and add them again.
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader title="Items" subtitle={`${inv.lines.length} ${inv.lines.length === 1 ? "line" : "lines"}`} />
              <LinesTable invoice={inv} />
            </Card>
          )}

          <Card>
            <CardHeader title="Payments" />
            <PaymentsTable invoice={inv} onReverse={can("invoice.cancel") && !cancelled ? setReversing : undefined} />
          </Card>

          {hasCreditNotes && (
            <Card>
              <CardHeader title="Credit notes" />
              <ul className="divide-y divide-border">
                {inv.creditNotes.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
                    <div className="min-w-0">
                      <Link
                        to={`/invoices/credit-notes/${c.id}`}
                        className="font-mono font-semibold text-navy-700 hover:underline"
                      >
                        {c.number}
                      </Link>
                      <p className="text-helper text-slate">
                        {formatDate(c.createdAt)} · {c.reason}
                      </p>
                    </div>
                    <div className="text-right tabular">
                      <p className="font-semibold text-ink">{money(c.total)}</p>
                      {Number(c.refunded) > 0 && <p className="text-helper text-slate">{money(c.refunded)} refunded</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Totals" />
            <CardBody className="space-y-2 text-body">
              {!oldDues && <Row label="Gross" value={money(inv.grossTotal)} />}
              {!oldDues && Number(inv.discountTotal) > 0 && (
                <Row
                  label={`Discount${inv.billDiscountType === "PERCENT" && inv.billDiscountValue ? ` (bill ${Number(inv.billDiscountValue)}%)` : ""}`}
                  value={`−${money(inv.discountTotal)}`}
                />
              )}
              {oldDues ? null : <Row label="Taxable value" value={money(inv.taxableTotal)} />}
              {oldDues ? null : inv.supplyType === "INTRA_STATE" ? (
                <>
                  <Row label="CGST" value={money(inv.cgstTotal)} />
                  <Row label="SGST" value={money(inv.sgstTotal)} />
                </>
              ) : (
                <Row label="IGST" value={money(inv.igstTotal)} />
              )}
              {Number(inv.roundOff) !== 0 && <Row label="Round off" value={money(inv.roundOff)} />}
              <div className={cn("flex items-baseline justify-between", !oldDues && "border-t border-border pt-3")}>
                <span className="font-semibold text-ink">{oldDues ? "Old dues" : "Total"}</span>
                <span className="text-section font-bold text-ink tabular">{money(inv.grandTotal)}</span>
              </div>
              <Row label="Paid" value={money(inv.paidTotal)} />
              {Number(inv.creditedTotal) > 0 && <Row label="Credit notes" value={`−${money(inv.creditedTotal)}`} />}
              <div className="flex items-baseline justify-between border-t border-border pt-3">
                <span className="font-semibold text-ink">Balance due</span>
                <span className={cn("font-bold tabular", due > 0 ? "text-danger" : "text-ink")}>
                  {money(inv.balanceDue)}
                </span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Details" />
            <CardBody>
              <dl className="space-y-3 text-body">
                <Meta label="Created by" value={inv.createdBy?.name} />
                <Meta label="Created" value={formatDateTime(inv.createdAt)} />
                {inv.shiftId && (
                  <Meta
                    label="Shift"
                    value={
                      <Link to={`/invoices/shifts/${inv.shiftId}`} className="text-navy-700 hover:underline">
                        View shift report
                      </Link>
                    }
                  />
                )}
                {inv.discountApprovedBy && <Meta label="Discount approved by" value={inv.discountApprovedBy.name} />}
                {inv.creditApprovedBy && <Meta label="Dues approved by" value={inv.creditApprovedBy.name} />}
                {inv.notes && <Meta label="Notes" value={inv.notes} />}
              </dl>
            </CardBody>
          </Card>
        </div>
      </div>

      <CollectPaymentDialog invoice={inv} open={collecting} onClose={() => setCollecting(false)} />
      <ReversePaymentDialog payment={reversing} onClose={() => setReversing(null)} />
      <CancelInvoiceDialog
        invoice={
          cancelling
            ? { id: inv.id, number: inv.number, itemCount: inv.itemCount, paidTotal: inv.paidTotal, oldDues }
            : null
        }
        onClose={() => setCancelling(false)}
      />
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

function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-helper text-slate">{label}</dt>
      <dd className="mt-0.5 text-ink">{value || "—"}</dd>
    </div>
  );
}

const th = "eyebrow h-11 px-4 font-semibold whitespace-nowrap text-slate";

function LinesTable({ invoice }: { invoice: InvoiceDetail }) {
  const intra = invoice.supplyType === "INTRA_STATE";
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-body">
        <thead>
          <tr className="border-b border-border bg-navy-50">
            <th className={cn(th, "w-10 text-left")}>#</th>
            <th className={cn(th, "text-left")}>Description</th>
            <th className={cn(th, "text-left")}>HSN/SAC</th>
            <th className={cn(th, "text-right")}>Qty</th>
            <th className={cn(th, "text-right")}>Rate</th>
            <th className={cn(th, "text-right")}>Discount</th>
            <th className={cn(th, "text-right")}>GST</th>
            <th className={cn(th, "text-right")}>Taxable</th>
            <th className={cn(th, "text-right")}>Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((l) => {
            const returned = Number(l.returnedQty);
            return (
              <tr key={l.id} className="border-b border-border align-top last:border-0">
                <td className="px-4 py-3 text-slate tabular">{l.lineNo}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{l.description}</p>
                  <p className="text-helper text-slate">
                    {l.sku ? <span className="font-mono">{l.sku}</span> : "Labour"}
                    {l.taxInclusive && " · price incl. GST"}
                  </p>
                </td>
                <td className="px-4 py-3 text-slate">{l.hsnSac ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular">
                  {formatQty(l.quantity)} {l.unit === "PCS" ? "" : l.unit}
                  {returned > 0 && <p className="text-helper text-warning">{formatQty(returned)} returned</p>}
                </td>
                <td className="px-4 py-3 text-right tabular">{money(l.rate)}</td>
                <td className="px-4 py-3 text-right tabular text-slate">
                  {Number(l.discount) > 0 ? money(l.discount) : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular">
                  {l.gstRate}%
                  <p className="text-helper text-slate">{money(intra ? Number(l.cgst) + Number(l.sgst) : l.igst)}</p>
                </td>
                <td className="px-4 py-3 text-right tabular">{money(l.taxable)}</td>
                <td className="px-4 py-3 text-right font-medium tabular">{money(l.total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const kindLabel = { RECEIPT: null, REVERSAL: "Reversal", REFUND: "Refund" } as const;

function PaymentsTable({ invoice, onReverse }: { invoice: InvoiceDetail; onReverse?: (p: Payment) => void }) {
  if (!invoice.payments.length) {
    return (
      <EmptyState
        className="py-10"
        title="No payments yet"
        description={
          Number(invoice.balanceDue) > 0
            ? "Customer has dues on this bill. Use Collect payment when they pay."
            : undefined
        }
      />
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-body">
        <thead>
          <tr className="border-b border-border">
            <th className={cn(th, "text-left")}>Date</th>
            <th className={cn(th, "text-left")}>Method</th>
            <th className={cn(th, "text-left")}>Reference</th>
            <th className={cn(th, "text-right")}>Amount</th>
            <th className={cn(th, "text-left")}>By</th>
            <th className="w-24" />
          </tr>
        </thead>
        <tbody>
          {invoice.payments.map((p) => {
            const negative = Number(p.amount) < 0;
            const tag = kindLabel[p.kind];
            return (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 whitespace-nowrap text-slate">{formatDateTime(p.receivedAt)}</td>
                <td className="px-4 py-3">
                  {PAYMENT_METHOD_LABELS[p.mode]}
                  {tag && <span className="ml-2 text-helper font-medium text-danger">{tag}</span>}
                  {p.reversed && <span className="ml-2 text-helper text-slate">(reversed)</span>}
                </td>
                <td className="px-4 py-3 text-slate">
                  {p.reference ?? "—"}
                  {p.note && <p className="text-helper">{p.note}</p>}
                  {p.tendered && <p className="text-helper">Cash received {money(p.tendered)}</p>}
                </td>
                <td className={cn("px-4 py-3 text-right font-medium tabular", negative ? "text-danger" : "text-ink")}>
                  {negative ? `−${money(Math.abs(Number(p.amount)))}` : money(p.amount)}
                </td>
                <td className="px-4 py-3 text-slate">{p.createdBy?.name ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  {onReverse && p.kind === "RECEIPT" && !p.reversed && (
                    <Button size="sm" variant="ghost" onClick={() => onReverse(p)}>
                      Reverse
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
