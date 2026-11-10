import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { formatINR, formatQty, PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from "@erp-software/shared";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Controls";
import { Field, FormGrid, Input, Select, Textarea } from "@/components/ui/Field";
import { EmptyState, ErrorBanner, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api-client";
import type { InvoiceDetail } from "@/lib/types";
import { cn, errorMessage } from "@/lib/utils";
import { useCreateCreditNote, useInvoice } from "../api";

const money = (v: number | string) => formatINR(v, { exact: true });

export function CreditNoteFormPage() {
  const { id } = useParams();
  const query = useInvoice(id);

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
  return <CreditNoteForm invoice={query.data} />;
}

function CreditNoteForm({ invoice }: { invoice: InvoiceDetail }) {
  const navigate = useNavigate();
  const toast = useToast();
  const create = useCreateCreditNote();
  // Typed text per line id, so partial input like "1." stays editable.
  const [qty, setQty] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [refundMode, setRefundMode] = useState<PaymentMethod>("CASH");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const lines = invoice.lines.map((l) => ({ ...l, returnable: Number(l.quantity) - Number(l.returnedQty) }));
  const chosen = lines.filter((l) => Number(qty[l.id] ?? 0) > 0);
  // Estimate only: the server credits proportionally and rounds the note to the rupee.
  const estimate = chosen.reduce((s, l) => s + (Number(l.total) * Number(qty[l.id])) / Number(l.quantity), 0);
  const paidBeyond =
    Number(invoice.paidTotal) - (Number(invoice.grandTotal) - Number(invoice.creditedTotal) - estimate);
  const refund = Math.max(paidBeyond, 0);

  if (invoice.status === "CANCELLED") {
    return (
      <Card>
        <EmptyState
          title={`${invoice.number} is cancelled`}
          description="Cancelled invoices already returned their stock and money."
        />
      </Card>
    );
  }

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!reason.trim()) next.reason = "Enter the reason for the return";
    lines.forEach((l) => {
      const raw = qty[l.id]?.trim();
      if (!raw) return;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) next[l.id] = "Enter a quantity";
      else if (n > l.returnable) next[l.id] = `At most ${formatQty(l.returnable)}`;
    });
    if (!chosen.length && !Object.keys(next).some((k) => k !== "reason"))
      next.lines = "Enter a quantity for at least one line";
    setErrors(next);
    if (Object.keys(next).length) return;

    const body = {
      invoiceId: invoice.id,
      reason: reason.trim(),
      refundMode,
      lines: chosen.map((l) => ({ invoiceLineId: l.id, quantity: Number(qty[l.id]) })),
    };
    try {
      const note = await create.mutateAsync(body);
      toast({ message: `Credit note ${note.number} created` });
      navigate(`/invoices/credit-notes/${note.id}`);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
        const mapped: Record<string, string> = {};
        for (const [key, message] of Object.entries(err.fieldErrors)) {
          const m = /^lines\.(\d+)/.exec(key);
          const line = m ? body.lines[Number(m[1])] : undefined;
          mapped[line ? line.invoiceLineId : key] = message;
        }
        setErrors(mapped);
      } else {
        toast({ message: errorMessage(err), tone: "error" });
      }
    }
  };

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <Link to="/invoices" className="hover:text-navy-700">
              Invoices
            </Link>{" "}
            /{" "}
            <Link to={`/invoices/${invoice.id}`} className="hover:text-navy-700">
              {invoice.number}
            </Link>{" "}
            / Credit note
          </>
        }
        title="New credit note"
        description={`Return items from ${invoice.number}${invoice.customerName ? ` · ${invoice.customerName}` : ""}. Returned parts go back to stock.`}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader title="Items to return" subtitle="Leave a line empty to keep it on the invoice." />
          <div className="overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b border-border">
                  <th className="eyebrow h-11 px-4 text-left font-semibold text-slate">Item</th>
                  <th className="eyebrow h-11 px-4 text-right font-semibold text-slate">Sold</th>
                  <th className="eyebrow h-11 px-4 text-right font-semibold text-slate">Can return</th>
                  <th className="eyebrow h-11 w-40 px-4 text-right font-semibold text-slate">Return</th>
                  <th className="eyebrow h-11 px-4 text-right font-semibold text-slate">Credit</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const n = Number(qty[l.id] ?? 0);
                  const credit = n > 0 && Number.isFinite(n) ? (Number(l.total) * n) / Number(l.quantity) : 0;
                  return (
                    <tr
                      key={l.id}
                      className={cn(
                        "border-b border-border align-top last:border-0",
                        l.returnable <= 0 && "opacity-60",
                      )}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{l.description}</p>
                        <p className="text-helper text-slate">
                          {l.sku ? <span className="font-mono">{l.sku}</span> : "Labour"} · {money(l.rate)} · GST{" "}
                          {l.gstRate}%
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right tabular">{formatQty(l.quantity)}</td>
                      <td className="px-4 py-3 text-right tabular">{formatQty(l.returnable)}</td>
                      <td className="px-4 py-2">
                        {l.returnable > 0 ? (
                          <>
                            <Input
                              aria-label={`Quantity to return of ${l.description}`}
                              aria-invalid={errors[l.id] ? true : undefined}
                              type="number"
                              inputMode="decimal"
                              min={0}
                              max={l.returnable}
                              step={l.unit === "PCS" || l.unit === "SVC" ? 1 : 0.001}
                              align="right"
                              placeholder="0"
                              value={qty[l.id] ?? ""}
                              onChange={(e) => {
                                setQty((q) => ({ ...q, [l.id]: e.target.value }));
                                setErrors((er) => ({ ...er, [l.id]: "", lines: "" }));
                              }}
                            />
                            {errors[l.id] && <p className="mt-1 text-right text-helper text-danger">{errors[l.id]}</p>}
                          </>
                        ) : (
                          <p className="py-2 text-right text-helper text-slate">All returned</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular">{credit > 0 ? money(credit) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {errors.lines && <p className="border-t border-border px-6 py-3 text-helper text-danger">{errors.lines}</p>}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Return details" />
            <CardBody>
              <FormGrid className="sm:grid-cols-1">
                <Field label="Reason" required error={errors.reason}>
                  {(p) => (
                    <Textarea
                      {...p}
                      rows={3}
                      maxLength={200}
                      placeholder="e.g. Wrong part, customer returned unused"
                      value={reason}
                      onChange={(e) => {
                        setReason(e.target.value);
                        setErrors((er) => ({ ...er, reason: "" }));
                      }}
                    />
                  )}
                </Field>
                <Field
                  label="Refund method"
                  error={errors.refundMode}
                  helper="Used only if the customer has paid more than the reduced total; otherwise the credit just lowers the balance due."
                >
                  {(p) => (
                    <Select {...p} value={refundMode} onChange={(e) => setRefundMode(e.target.value as PaymentMethod)}>
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {PAYMENT_METHOD_LABELS[m]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </FormGrid>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Estimate" subtitle="The credit note is rounded to the rupee when saved." />
            <CardBody className="space-y-2 text-body">
              <div className="flex justify-between">
                <span className="text-slate">Credit</span>
                <span className="font-semibold text-ink tabular">{money(estimate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate">Balance due now</span>
                <span className="text-ink tabular">{money(invoice.balanceDue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate">Refund to customer</span>
                <span className={cn("tabular", refund > 0 ? "font-semibold text-ink" : "text-slate")}>
                  {refund > 0 ? `${money(refund)} · ${PAYMENT_METHOD_LABELS[refundMode]}` : "None"}
                </span>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3 border-t border-border pt-5">
        <Button variant="ghost" onClick={() => navigate(`/invoices/${invoice.id}`)}>
          Cancel
        </Button>
        <Button
          loading={create.isPending}
          loadingText="Saving…"
          disabled={!chosen.length}
          onClick={() => void submit()}
        >
          Create credit note{estimate > 0 ? ` · ${money(estimate)}` : ""}
        </Button>
      </div>
    </>
  );
}
