import { useState } from "react";
import { Link } from "react-router";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { formatINR, PAYMENT_METHOD_LABELS, POS_PAYMENT_METHODS, type PaymentMethod } from "@erp-software/shared";
import { useAuth } from "@/app/auth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorBanner, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useCloseShift, useDiscardHeldCart, useHeldCarts, useOpenShift } from "@/features/invoices/api";
import type { CustomerCredit, HeldCart, ShiftReport } from "@/lib/types";
import { cn, errorMessage, formatDateTime } from "@/lib/utils";
import type { PosMode } from "./CartPanel";

export interface PaymentRow {
  mode: PaymentMethod;
  amount: number;
  tendered?: number | null;
  reference?: string | null;
}

const toPaise = (s: string) => Math.round((Number(s) || 0) * 100);
const inr = (paise: number) => formatINR(paise / 100, { exact: true });

// ---------- Payment (split, tendered, credit remainder) ----------

interface DraftRow {
  mode: PaymentMethod;
  amount: string;
  tendered: string;
  reference: string;
}

export function PaymentDialog({
  open,
  totalPaise,
  mode,
  customer,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  totalPaise: number;
  mode: PosMode;
  customer: CustomerCredit | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (payments: PaymentRow[]) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={`Collect ${formatINR(totalPaise / 100)}`} size="md">
      {open && (
        <PaymentForm
          totalPaise={totalPaise}
          mode={mode}
          customer={customer}
          busy={busy}
          onCancel={onClose}
          onConfirm={onConfirm}
        />
      )}
    </Modal>
  );
}

function PaymentForm({
  totalPaise,
  mode,
  customer,
  busy,
  onCancel,
  onConfirm,
}: {
  totalPaise: number;
  mode: PosMode;
  customer: CustomerCredit | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (payments: PaymentRow[]) => void;
}) {
  const { can } = useAuth();
  const amount = (totalPaise / 100).toFixed(2);
  const [rows, setRows] = useState<DraftRow[]>(
    mode === "CREDIT" ? [] : [{ mode, amount, tendered: mode === "CASH" ? amount : "", reference: "" }],
  );
  const paid = rows.reduce((s, r) => s + toPaise(r.amount), 0);
  const remainder = totalPaise - paid;
  const change = rows.reduce(
    (s, r) => s + (r.mode === "CASH" && r.tendered ? Math.max(toPaise(r.tendered) - toPaise(r.amount), 0) : 0),
    0,
  );
  const overCredit =
    remainder > 0 && customer ? remainder > toPaise(customer.availableCredit) && !can("credit.override") : false;

  const rowErrors = rows.map((r) => {
    const a = toPaise(r.amount);
    if (a <= 0) return "Enter an amount";
    if (r.mode === "CASH" && r.tendered && toPaise(r.tendered) < a) return "Cash received is less than the bill amount";
    return null;
  });
  const error =
    remainder < 0
      ? "Payments are more than the total"
      : remainder > 0 && !customer
        ? `${inr(remainder)} is unpaid. A walk-in customer must pay the full bill. Add the customer to keep the rest as dues.`
        : remainder > 0 && change > 0
          ? `Cash received is more than the amount, but ${inr(remainder)} is still due. Raise the amount instead of giving change.`
          : (rowErrors.find(Boolean) ?? null);

  const update = (i: number, patch: Partial<DraftRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <form
      className="space-y-4"
      onKeyDown={(e) => {
        // Enter charges from anywhere in the dialog (incl. the Mode select, which swallows Enter natively).
        // Buttons keep their own Enter behaviour (e.g. "Back to cart", "Remove payment").
        if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
        const t = e.target as HTMLElement;
        if (t.tagName === "BUTTON" || t.tagName === "TEXTAREA") return;
        e.preventDefault();
        if (!error && !busy) e.currentTarget.requestSubmit();
      }}
      onSubmit={(e) => {
        e.preventDefault();
        if (error || busy) return;
        onConfirm(
          rows.map((r) => ({
            mode: r.mode,
            amount: toPaise(r.amount) / 100,
            tendered: r.mode === "CASH" && r.tendered ? toPaise(r.tendered) / 100 : null,
            reference: r.reference.trim() || null,
          })),
        );
      }}
    >
      {rows.length === 0 && (
        <p className="rounded-input bg-navy-50 px-3 py-2.5 text-body text-ink">
          The full {inr(totalPaise)} is kept as {customer?.name ?? "the customer"}'s dues (pay later).
        </p>
      )}
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)_32px] items-end gap-3">
          <Field label={i === 0 ? "Mode" : ""}>
            {(p) => (
              <Select
                {...p}
                value={r.mode}
                onChange={(e) => update(i, { mode: e.target.value as PaymentMethod, tendered: "" })}
              >
                {POS_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={i === 0 ? "Amount" : ""}>
            {(p) => (
              <Input
                {...p}
                autoFocus={i === rows.length - 1}
                inputMode="decimal"
                align="right"
                suffix="₹"
                value={r.amount}
                onChange={(e) =>
                  // Cash received follows the amount while it still matches (i.e. the cashier hasn't typed
                  // a different note value), so paying less doesn't leave the old total as "cash received".
                  update(i, {
                    amount: e.target.value,
                    ...(r.mode === "CASH" && (!r.tendered || r.tendered === r.amount)
                      ? { tendered: e.target.value }
                      : {}),
                  })
                }
              />
            )}
          </Field>
          {r.mode === "CASH" ? (
            <Field label="Cash received">
              {(p) => (
                <Input
                  {...p}
                  inputMode="decimal"
                  align="right"
                  suffix="₹"
                  value={r.tendered}
                  onChange={(e) => update(i, { tendered: e.target.value })}
                />
              )}
            </Field>
          ) : (
            <Field label="Reference">
              {(p) => (
                <Input
                  {...p}
                  placeholder={r.mode === "CARD" ? "Last 4 / approval code" : "UPI ref no."}
                  value={r.reference}
                  onChange={(e) => update(i, { reference: e.target.value })}
                />
              )}
            </Field>
          )}
          <button
            type="button"
            aria-label="Remove payment"
            onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
            className="mb-1 inline-flex size-8 items-center justify-center rounded-input text-slate hover:bg-danger-50 hover:text-danger"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        icon={<Plus className="size-4" />}
        disabled={remainder <= 0}
        onClick={() =>
          setRows((rs) => [
            ...rs,
            {
              mode: rs.some((r) => r.mode === "UPI") ? "CARD" : "UPI",
              amount: (remainder / 100).toFixed(2),
              tendered: "",
              reference: "",
            },
          ])
        }
      >
        Split payment
      </Button>

      <dl className="space-y-1.5 rounded-card border border-border p-4 text-body">
        <div className="flex justify-between">
          <dt className="text-slate">Total</dt>
          <dd className="font-semibold tabular">{inr(totalPaise)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate">Paid now</dt>
          <dd className="tabular">{inr(paid)}</dd>
        </div>
        {remainder > 0 && (
          <div className="flex justify-between">
            <dt className="text-slate">Dues (pay later)</dt>
            <dd className={cn("tabular", customer ? "text-ink" : "text-danger")}>{inr(remainder)}</dd>
          </div>
        )}
        {change > 0 && (
          <div className="flex justify-between border-t border-border pt-2 text-card">
            <dt className="font-semibold">Change to return</dt>
            <dd className="font-bold tabular">{inr(change)}</dd>
          </div>
        )}
      </dl>
      {overCredit && (
        <p className="rounded-input bg-warning-50 px-3 py-2 text-helper text-warning">
          This is more dues than {customer?.name} is allowed (
          {formatINR(customer?.availableCredit ?? 0, { exact: true })} left). A manager will approve it.
        </p>
      )}
      {error && <p className="text-helper text-danger">{error}</p>}

      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel}>
          Back to cart
        </Button>
        <Button type="submit" variant="accent" size="lg" disabled={Boolean(error)} loading={busy} loadingText="Saving…">
          Charge {formatINR(totalPaise / 100)}
        </Button>
      </div>
    </form>
  );
}

// ---------- Manager approval ----------

export function OverrideDialog({
  open,
  message,
  approvals,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  message: string;
  approvals: string[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (override: { email: string; password: string }) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const what = approvals
    .map((a) => (a === "discount" ? "the discount" : "dues above the customer's limit"))
    .join(" and ");
  return (
    <Modal open={open} onClose={onClose} title="Manager approval needed">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ email, password });
          setPassword("");
        }}
      >
        <p className="flex gap-2 text-body text-slate">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-navy-700" />
          <span>
            {message}. A manager signs in here to approve {what || "this sale"}; the approval is recorded on the
            invoice.
          </span>
        </p>
        <Field label="Manager email">
          {(p) => (
            <Input
              {...p}
              type="email"
              autoComplete="off"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        <Field label="Password">
          {(p) => (
            <Input
              {...p}
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!email || !password} loading={busy} loadingText="Checking…">
            Approve and charge
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Hold (F8) ----------

export function HoldDialog({
  open,
  busy,
  onClose,
  onHold,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onHold: (label: string) => void;
}) {
  const [label, setLabel] = useState("");
  return (
    <Modal open={open} onClose={onClose} title="Hold this cart?">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onHold(label.trim());
          setLabel("");
        }}
      >
        <Field label="Label" helper="Optional, e.g. the customer's name or vehicle. Resume it from Held carts.">
          {(p) => <Input {...p} autoFocus maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} />}
        </Field>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Keep billing
          </Button>
          <Button type="submit" loading={busy}>
            Hold cart
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function HeldCartsDialog({
  open,
  resuming,
  onClose,
  onResume,
}: {
  open: boolean;
  resuming: string | null;
  onClose: () => void;
  onResume: (cart: HeldCart) => void;
}) {
  const held = useHeldCarts();
  const discard = useDiscardHeldCart();
  const toast = useToast();
  const [discarding, setDiscarding] = useState<HeldCart | null>(null);

  return (
    <Modal open={open} onClose={onClose} title="Held carts" size="md">
      {held.error ? (
        <ErrorBanner
          title="Couldn't load held carts"
          message={errorMessage(held.error)}
          onRetry={() => void held.refetch()}
        />
      ) : !held.data ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full rounded-card" />
          <Skeleton className="h-14 w-full rounded-card" />
        </div>
      ) : held.data.length === 0 ? (
        <EmptyState
          title="No held carts"
          description="Press F8 to park a sale and serve the next customer."
          className="py-8"
        />
      ) : (
        <ul className="divide-y divide-border rounded-card border border-border">
          {held.data.map((h) => (
            <li key={h.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{h.label || h.customerName || "Unlabelled cart"}</p>
                <p className="text-helper text-slate">
                  {h.lineCount} {h.lineCount === 1 ? "line" : "lines"} · {formatDateTime(h.createdAt)}
                  {h.createdBy && ` · ${h.createdBy.name}`}
                </p>
              </div>
              <span className="font-semibold tabular">{formatINR(h.total)}</span>
              <Button size="sm" loading={resuming === h.id} onClick={() => onResume(h)}>
                Resume
              </Button>
              <Button size="sm" variant="danger-outline" onClick={() => setDiscarding(h)}>
                Discard
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={Boolean(discarding)}
        title="Discard this held cart?"
        body="The cart is removed for everyone at this branch. Nothing was billed or taken from stock."
        cancelLabel="Keep it"
        confirmLabel="Discard cart"
        loading={discard.isPending}
        onClose={() => setDiscarding(null)}
        onConfirm={async () => {
          try {
            await discard.mutateAsync(discarding!.id);
          } catch (err) {
            toast({ message: errorMessage(err), tone: "error" });
          }
          setDiscarding(null);
        }}
      />
    </Modal>
  );
}

// ---------- Shifts ----------

export function OpenShiftCard() {
  const { me, branch } = useAuth();
  const open = useOpenShift();
  const toast = useToast();
  const [counter, setCounter] = useState("Counter 1");
  const [cash, setCash] = useState("");
  const cashOk = cash === "" || (Number.isFinite(Number(cash)) && Number(cash) >= 0);

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-section font-semibold text-ink">Open a shift to start billing</h1>
        <p className="mt-1 text-body text-slate">
          {me?.user.firstName}, count the cash in the drawer at {branch?.name}. At close you'll count again and see any
          difference.
        </p>
        <form
          className="mt-5 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!cashOk || !counter.trim()) return;
            try {
              await open.mutateAsync({ counter: counter.trim(), openingCash: Number(cash || 0) });
              toast({ message: "Shift opened" });
            } catch (err) {
              toast({ message: errorMessage(err), tone: "error" });
            }
          }}
        >
          <Field label="Counter" required>
            {(p) => <Input {...p} maxLength={30} value={counter} onChange={(e) => setCounter(e.target.value)} />}
          </Field>
          <Field label="Opening cash" error={cashOk ? undefined : "Enter an amount"}>
            {(p) => (
              <Input
                {...p}
                autoFocus
                inputMode="decimal"
                align="right"
                suffix="₹"
                placeholder="0"
                value={cash}
                onChange={(e) => setCash(e.target.value)}
              />
            )}
          </Field>
          <Button type="submit" className="w-full" loading={open.isPending} disabled={!cashOk || !counter.trim()}>
            Open shift
          </Button>
        </form>
      </Card>
    </div>
  );
}

const COUNTED: PaymentMethod[] = ["CASH", "UPI", "CARD"];

export function CloseShiftDialog({
  shift,
  open,
  onClose,
  onExit,
}: {
  shift: ShiftReport;
  open: boolean;
  onClose: () => void;
  onExit: () => void;
}) {
  const close = useCloseShift();
  const toast = useToast();
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [result, setResult] = useState<ShiftReport | null>(null);
  const expected = (m: PaymentMethod) => shift.methods.find((x) => x.mode === m)?.expected ?? "0.00";

  if (result) {
    return (
      <Modal
        open={open}
        onClose={onExit}
        title={`Shift closed · ${result.counter}`}
        footer={
          <>
            <Link
              to={`/invoices/shifts/${result.id}`}
              className="inline-flex h-10 items-center rounded-input border border-border px-4 font-semibold text-navy-700 hover:bg-navy-50"
            >
              View report
            </Link>
            <Button onClick={onExit}>Exit POS</Button>
          </>
        }
      >
        <p className="mb-3 text-body text-slate">
          {result.invoiceCount} invoices · sales {formatINR(result.salesTotal, { exact: true })}
          {result.cancelledCount ? ` · ${result.cancelledCount} cancelled` : ""}
        </p>
        <VarianceTable report={result} />
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Close shift?" size="md">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const body = {
              counted: Object.fromEntries(COUNTED.map((m) => [m, Number(counted[m] || 0)])),
              note: note.trim() || null,
            };
            setResult(await close.mutateAsync({ id: shift.id, body }));
          } catch (err) {
            toast({ message: errorMessage(err), tone: "error" });
          }
        }}
      >
        <p className="text-body text-slate">
          Count what you took per method. Expected includes the opening cash of{" "}
          {formatINR(shift.openingCash, { exact: true })}.
        </p>
        <div className="space-y-3">
          {COUNTED.map((m) => (
            <div key={m} className="grid grid-cols-[100px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3">
              <span className="font-medium text-ink">{PAYMENT_METHOD_LABELS[m]}</span>
              <span className="text-right text-helper text-slate tabular">
                Expected {formatINR(expected(m), { exact: true })}
              </span>
              <Input
                aria-label={`Counted ${PAYMENT_METHOD_LABELS[m]}`}
                inputMode="decimal"
                align="right"
                suffix="₹"
                placeholder="0"
                value={counted[m] ?? ""}
                onChange={(e) => setCounted((c) => ({ ...c, [m]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <Field label="Note">
          {(p) => <Textarea {...p} rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Keep shift open
          </Button>
          <Button type="submit" loading={close.isPending}>
            Close shift
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function VarianceTable({ report }: { report: ShiftReport }) {
  const rows = report.methods.filter((m) => Number(m.expected) !== 0 || Number(m.counted ?? 0) !== 0);
  return (
    <table className="w-full text-body">
      <thead>
        <tr className="border-b border-border text-slate">
          <th className="py-2 text-left font-medium">Method</th>
          <th className="py-2 text-right font-medium">Expected</th>
          <th className="py-2 text-right font-medium">Counted</th>
          <th className="py-2 text-right font-medium">Difference</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((m) => {
          const v = Number(m.variance ?? 0);
          return (
            <tr key={m.mode} className="border-b border-border last:border-0">
              <td className="py-2">{PAYMENT_METHOD_LABELS[m.mode]}</td>
              <td className="py-2 text-right tabular">{formatINR(m.expected, { exact: true })}</td>
              <td className="py-2 text-right tabular">{formatINR(m.counted ?? 0, { exact: true })}</td>
              <td
                className={cn(
                  "py-2 text-right font-semibold tabular",
                  v < 0 ? "text-danger" : v > 0 ? "text-warning" : "text-success",
                )}
              >
                {v === 0 ? "—" : `${v > 0 ? "+" : "−"}${formatINR(Math.abs(v), { exact: true })}`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
