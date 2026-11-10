import { useEffect, useState, type Ref } from "react";
import { AlertTriangle, Minus, Percent, Plus, ShoppingCart, Tag, Trash2, UserPlus, UserRound, X } from "lucide-react";
import { formatINR, formatMobile, formatQty, type PricedCart, type SupplyType } from "@erp-software/shared";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/Controls";
import { Field, Input } from "@/components/ui/Field";
import { Kbd } from "@/components/ui/Kbd";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useCustomerCredit } from "@/features/invoices/api";
import { api } from "@/lib/api-client";
import type { Customer, CustomerCredit } from "@/lib/types";
import { cn, errorMessage } from "@/lib/utils";
import { lineKey, qtyOf, type CartAction, type CartState } from "./cart";

export type PosMode = "CASH" | "UPI" | "CARD" | "CREDIT";
// Order matters: Alt+1 … Alt+4.
export const MODES: { value: PosMode; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "CREDIT", label: "Pay later" },
];

const inr = (paise: number) => formatINR(paise / 100, { exact: true });

// Right pane: customer, cart lines, discounts, totals and the payment action (M5.4–M5.8).
export function CartPanel({
  cart,
  dispatch,
  totals,
  supplyType,
  approvalNote,
  serverIssues,
  mode,
  onMode,
  onCharge,
  charging,
  selectedKey,
  onSelect,
  lineDiscountKey,
  onLineDiscount,
  billDiscountOpen,
  onBillDiscount,
  customerInput,
}: {
  cart: CartState;
  dispatch: (a: CartAction) => void;
  totals: PricedCart;
  supplyType: SupplyType;
  approvalNote: string | null;
  serverIssues: string[];
  mode: PosMode;
  onMode: (m: PosMode) => void;
  onCharge: () => void;
  charging: boolean;
  /** Line picked with ↑/↓ or a click; +, −, Del and Shift+F9 act on it. */
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  lineDiscountKey: string | null;
  onLineDiscount: (key: string | null) => void;
  billDiscountOpen: boolean;
  onBillDiscount: (open: boolean) => void;
  customerInput?: Ref<HTMLInputElement>;
}) {
  const editing = lineDiscountKey;
  const setEditing = onLineDiscount;
  const billOpen = billDiscountOpen;
  const setBillOpen = onBillDiscount;

  // Keep the keyboard-selected line in view.
  useEffect(() => {
    if (selectedKey) document.getElementById(`pos-line-${selectedKey}`)?.scrollIntoView({ block: "nearest" });
  }, [selectedKey]);
  const units = cart.lines.reduce((s, l) => s + qtyOf(l), 0);
  const issues = [...totals.issues.map((i) => i.message), ...serverIssues];
  const editingLine = cart.lines.find((l) => lineKey(l) === editing);

  return (
    <aside className="flex min-h-0 flex-col rounded-card border border-border bg-surface" aria-label="Cart">
      <CustomerBox
        inputRef={customerInput}
        customer={cart.customer}
        onChange={(customer) => dispatch({ type: "setCustomer", customer })}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {cart.lines.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Cart is empty"
            description="Scan a barcode or tap a product to add it."
            className="py-10"
          />
        ) : (
          <ul className="divide-y divide-border">
            {cart.lines.map((l, i) => {
              const key = lineKey(l);
              const priced = totals.lines[i];
              const qty = qtyOf(l);
              const short = l.available !== null && qty > l.available;
              return (
                <li
                  key={key}
                  id={`pos-line-${key}`}
                  aria-selected={selectedKey === key}
                  onClick={() => onSelect(key)}
                  className={cn(
                    "border-l-4 px-4 py-3 transition-colors",
                    selectedKey === key ? "border-l-yellow-500 bg-navy-50" : "border-l-transparent",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-medium text-ink">{l.name}</p>
                      <p className="text-helper text-slate tabular">
                        {formatINR(l.rate, { exact: true })}
                        {l.unit !== "PCS" && l.unit !== "SVC" ? ` / ${l.unit}` : ""}
                        {l.sku && <span className="font-mono"> · {l.sku}</span>}
                      </p>
                    </div>
                    <p className="text-body font-semibold text-ink tabular">
                      {priced ? inr(priced.grossPaise - priced.lineDiscountPaise) : "—"}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="inline-flex items-center rounded-input border border-border">
                      <button
                        type="button"
                        aria-label={`One less ${l.name}`}
                        onClick={() => dispatch({ type: "step", key, delta: -1 })}
                        className="inline-flex size-8 items-center justify-center text-navy-700 hover:bg-navy-50"
                      >
                        <Minus className="size-4" />
                      </button>
                      <input
                        aria-label={`Quantity of ${l.name}`}
                        inputMode="decimal"
                        data-qty={key}
                        onFocus={() => onSelect(key)}
                        onKeyDown={(e) => {
                          // Enter or Esc returns to line navigation.
                          if (e.key === "Enter" || e.key === "Escape") {
                            e.preventDefault();
                            e.currentTarget.blur();
                          }
                        }}
                        value={l.quantity}
                        onChange={(e) =>
                          dispatch({ type: "setQty", key, quantity: e.target.value.replace(/[^\d.]/g, "") })
                        }
                        className="h-8 w-14 border-x border-border text-center text-body tabular focus:outline-none"
                      />
                      <button
                        type="button"
                        aria-label={`One more ${l.name}`}
                        onClick={() => dispatch({ type: "step", key, delta: 1 })}
                        className="inline-flex size-8 items-center justify-center text-navy-700 hover:bg-navy-50"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditing(key)}
                      className={cn(
                        "inline-flex h-8 items-center gap-1 rounded-input px-2 text-helper",
                        l.discount > 0 ? "font-medium text-success hover:bg-success-50" : "text-slate hover:bg-navy-50",
                      )}
                    >
                      <Tag className="size-3.5" />
                      {l.discount > 0 ? `−${formatINR(l.discount, { exact: true })}` : "Discount"}
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${l.name}`}
                      onClick={() => dispatch({ type: "remove", key })}
                      className="ml-auto inline-flex size-8 items-center justify-center rounded-input text-slate hover:bg-danger-50 hover:text-danger"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  {short && (
                    <p className="mt-1.5 flex items-center gap-1 text-helper text-warning">
                      <AlertTriangle className="size-3.5" /> Only {formatQty(Math.max(l.available ?? 0, 0))} available
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-border px-4 py-3">
        <dl className="space-y-1.5 text-body">
          <Row
            label={`Subtotal (${formatQty(units)} ${units === 1 ? "item" : "items"})`}
            value={inr(totals.grossPaise)}
          />
          <div className="flex items-center justify-between">
            <dt>
              <button
                type="button"
                onClick={() => setBillOpen(true)}
                className="inline-flex items-center gap-1 text-navy-700 hover:underline"
              >
                <Percent className="size-3.5" /> Discount
                {cart.billDiscount?.value ? (
                  <span className="text-slate">
                    {" "}
                    ({cart.billDiscount.type === "PERCENT" ? `${cart.billDiscount.value}% on bill` : "on bill"})
                  </span>
                ) : null}
              </button>
            </dt>
            <dd className={cn("tabular", totals.discountPaise > 0 ? "text-success" : "text-slate")}>
              {totals.discountPaise > 0 ? `−${inr(totals.discountPaise)}` : inr(0)}
            </dd>
          </div>
          {supplyType === "INTRA_STATE" ? (
            <>
              <Row label="CGST" value={inr(totals.cgstPaise)} muted />
              <Row label="SGST" value={inr(totals.sgstPaise)} muted />
            </>
          ) : (
            <Row label="IGST" value={inr(totals.igstPaise)} muted />
          )}
          <Row
            label="Round off"
            value={`${totals.roundOffPaise > 0 ? "+" : totals.roundOffPaise < 0 ? "−" : ""}${inr(Math.abs(totals.roundOffPaise))}`}
            muted
          />
        </dl>
        <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
          <span className="text-card font-semibold text-ink">Total payable</span>
          <span className="text-kpi font-bold text-ink tabular">{formatINR(totals.totalPaise / 100)}</span>
        </div>
        {approvalNote && (
          <p className="mt-2 rounded-input bg-warning-50 px-3 py-2 text-helper text-warning">{approvalNote}</p>
        )}
        {issues.length > 0 && (
          <ul className="mt-2 space-y-1 rounded-input bg-danger-50 px-3 py-2 text-helper text-danger">
            {[...new Set(issues)].map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t border-border p-4">
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Payment mode">
          {MODES.map((m, i) => {
            const disabled = m.value === "CREDIT" && !cart.customer;
            return (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={mode === m.value}
                disabled={disabled}
                title={disabled ? "Add the customer first to let them pay later" : `Alt+${i + 1}`}
                onClick={() => onMode(m.value)}
                className={cn(
                  "h-10 rounded-input border text-body font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  mode === m.value
                    ? "border-navy-900 bg-navy-900 text-white"
                    : "border-border text-navy-700 hover:bg-navy-50",
                )}
              >
                <span className="block leading-tight">{m.label}</span>
                <span className="block text-[10px] leading-tight font-medium opacity-60">Alt+{i + 1}</span>
              </button>
            );
          })}
        </div>
        {mode === "CREDIT" && cart.customer && <CreditLine customer={cart.customer} />}
        <Button
          variant="accent"
          size="lg"
          className="w-full"
          disabled={!cart.lines.length || totals.issues.length > 0}
          loading={charging}
          loadingText="Saving…"
          onClick={onCharge}
        >
          Charge {formatINR(totals.totalPaise / 100)}
          <Kbd className="ml-2 border-0 bg-navy-900/10">F12</Kbd>
        </Button>
      </div>

      <LineDiscountModal
        open={Boolean(editingLine)}
        name={editingLine?.name ?? ""}
        max={editingLine ? editingLine.rate * qtyOf(editingLine) : 0}
        value={editingLine?.discount ?? 0}
        onClose={() => setEditing(null)}
        onSave={(discount) => {
          if (editing) dispatch({ type: "setDiscount", key: editing, discount });
          setEditing(null);
        }}
      />
      <BillDiscountModal
        open={billOpen}
        value={cart.billDiscount}
        onClose={() => setBillOpen(false)}
        onSave={(billDiscount) => {
          dispatch({ type: "setBillDiscount", billDiscount });
          setBillOpen(false);
        }}
      />
    </aside>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={muted ? "text-slate" : "text-ink"}>{label}</dt>
      <dd className={cn("tabular", muted ? "text-slate" : "text-ink")}>{value}</dd>
    </div>
  );
}

function CreditLine({ customer }: { customer: CustomerCredit }) {
  const live = useCustomerCredit(customer.id).data ?? customer;
  return (
    <p className="text-helper text-slate">
      Can still owe{" "}
      <span className="font-semibold text-ink tabular">{formatINR(live.availableCredit, { exact: true })}</span> of{" "}
      {formatINR(live.creditLimit)} · pay within {live.creditDays} days
    </p>
  );
}

// ---------- Customer ----------

function CustomerBox({
  customer,
  onChange,
  inputRef,
}: {
  inputRef?: Ref<HTMLInputElement>;
  customer: CustomerCredit | null;
  onChange: (c: CustomerCredit | null) => void;
}) {
  const toast = useToast();
  const [mobile, setMobile] = useState("");
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const attach = async () => {
    const digits = mobile.replace(/\D/g, "").slice(-10);
    if (digits.length !== 10) {
      toast({ message: "Enter a 10-digit mobile number", tone: "error" });
      return;
    }
    setBusy(true);
    setNotFound(false);
    try {
      const found = await api.get<Customer | null>("/customers/lookup", { mobile: digits });
      if (!found) {
        setNotFound(true);
        return;
      }
      onChange(await api.get<CustomerCredit>(`/invoices/customer-credit/${found.id}`));
      setMobile("");
    } catch (err) {
      toast({ message: errorMessage(err), tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (customer) {
    return (
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy-50 text-navy-700">
          <UserRound className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-semibold text-ink">{customer.name}</p>
          <p className="text-helper text-slate tabular">
            {formatMobile(customer.mobile)}
            {customer.gstin && ` · ${customer.gstin}`}
          </p>
        </div>
        {Number(customer.outstanding) > 0 && <Badge tone="warning">Owes {formatINR(customer.outstanding)}</Badge>}
        <Button size="sm" variant="outline" onClick={() => onChange(null)}>
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className="border-b border-border px-4 py-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void attach();
        }}
      >
        <Input
          ref={inputRef}
          aria-label="Customer mobile"
          inputMode="tel"
          placeholder="Customer mobile (or walk-in)   (F7)"
          value={mobile}
          onChange={(e) => {
            setMobile(e.target.value);
            setNotFound(false);
          }}
        />
        <Button type="submit" variant="outline" loading={busy}>
          Attach
        </Button>
      </form>
      {notFound && (
        <p className="mt-2 flex items-center gap-1.5 text-helper text-slate">
          No customer has this number.
          <a
            href={`/customers/new?mobile=${encodeURIComponent(mobile.trim())}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-navy-700 hover:underline"
          >
            <UserPlus className="size-3.5" /> New customer
          </a>
          <button type="button" aria-label="Dismiss" onClick={() => setNotFound(false)} className="ml-auto text-slate">
            <X className="size-3.5" />
          </button>
        </p>
      )}
    </div>
  );
}

// ---------- Discounts ----------

function LineDiscountModal({
  open,
  name,
  max,
  value,
  onClose,
  onSave,
}: {
  open: boolean;
  name: string;
  max: number;
  value: number;
  onClose: () => void;
  onSave: (discount: number) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={`Discount on ${name}`}>
      {open && (
        <DiscountForm
          max={max}
          initial={{ type: "AMOUNT", value }}
          onSave={(d) => onSave(d.type === "PERCENT" ? Math.round(max * d.value) / 100 : d.value)}
          onCancel={onClose}
        />
      )}
    </Modal>
  );
}

function BillDiscountModal({
  open,
  value,
  onClose,
  onSave,
}: {
  open: boolean;
  value: CartState["billDiscount"];
  onClose: () => void;
  onSave: (d: CartState["billDiscount"]) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Discount on the bill">
      {open && (
        <DiscountForm
          initial={value ?? { type: "PERCENT", value: 0 }}
          hint="Spread across the lines by amount, before GST."
          onSave={(d) => onSave(d.value > 0 ? d : null)}
          onCancel={onClose}
        />
      )}
    </Modal>
  );
}

function DiscountForm({
  initial,
  max,
  hint,
  onSave,
  onCancel,
}: {
  initial: { type: "AMOUNT" | "PERCENT"; value: number };
  max?: number;
  hint?: string;
  onSave: (d: { type: "AMOUNT" | "PERCENT"; value: number }) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState(initial.type);
  const [text, setText] = useState(initial.value ? String(initial.value) : "");
  const n = text === "" ? 0 : Number(text);
  const error =
    !Number.isFinite(n) || n < 0
      ? "Enter a number"
      : type === "PERCENT" && n > 100
        ? "At most 100%"
        : type === "AMOUNT" && max !== undefined && n > max
          ? `At most ${formatINR(max, { exact: true })}`
          : undefined;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!error) onSave({ type, value: Math.round(n * 100) / 100 });
      }}
    >
      <SegmentedControl
        label="Discount type"
        value={type}
        onChange={setType}
        options={[
          { value: "AMOUNT", label: "₹ Amount" },
          { value: "PERCENT", label: "% Percent" },
        ]}
      />
      <Field label={type === "PERCENT" ? "Percent" : "Amount"} error={error} helper={hint}>
        {(p) => (
          <Input
            {...p}
            autoFocus
            inputMode="decimal"
            align="right"
            suffix={type === "PERCENT" ? "%" : "₹"}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        )}
      </Field>
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={() => onSave({ type, value: 0 })}>
          Remove discount
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={Boolean(error)}>
          Apply
        </Button>
      </div>
    </form>
  );
}
