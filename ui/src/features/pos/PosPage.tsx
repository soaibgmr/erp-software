import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ChevronLeft, Clock, Keyboard, PauseCircle, Power, Printer } from "lucide-react";
import { priceCart, supplyTypeFor, type PrintFormat } from "@erp-software/shared";
import { useAuth } from "@/app/auth";
import { Logo } from "@/app/AppShell";
import { useHotkey } from "@/app/hotkeys";
import { CountBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Kbd";
import { ConfirmDialog } from "@/components/ui/Modal";
import { ErrorBanner, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useCharge, useCurrentShift, useHeldCarts, useHoldCart, useQuote } from "@/features/invoices/api";
import { useSettings } from "@/features/settings/api";
import { ApiError, api } from "@/lib/api-client";
import { useDebounced } from "@/lib/hooks";
import type { HeldCart, ItemSearchResult, Quote, ShiftReport } from "@/lib/types";
import { invoicePrintPath, paramFor, printInBackground } from "@/lib/print";
import { errorMessage } from "@/lib/utils";
import { BillSavedDialog, type SavedBill } from "./BillSavedDialog";
import { cartReducer, lineKey, loadCart, qtyOf, saveCart, toCartBody, type CartLine } from "./cart";
import { CustomerStep } from "./CustomerStep";
import { CartPanel, MODES, type PosMode } from "./CartPanel";
import {
  CloseShiftDialog,
  HeldCartsDialog,
  HoldDialog,
  OpenShiftCard,
  OverrideDialog,
  PaymentDialog,
  type PaymentRow,
} from "./Dialogs";
import { itemToLine, ProductPane } from "./ProductPane";
import { ShortcutsDialog } from "./ShortcutsDialog";

const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

// Full-screen POS (PRD M5): its own header, product grid on the left, cart and payment on the right.
export function PosPage() {
  const { branch } = useAuth();
  const navigate = useNavigate();
  const shift = useCurrentShift();
  const [heldOpen, setHeldOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useHotkey("f1", () => setHelpOpen(true), { skipInDialogs: true });

  return (
    <div className="flex h-screen min-h-0 flex-col bg-canvas">
      <PosHeader
        shift={shift.data ?? null}
        onHeld={() => setHeldOpen(true)}
        onCloseShift={() => setClosing(true)}
        onHelp={() => setHelpOpen(true)}
      />
      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      {shift.isPending ? (
        <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <Skeleton className="h-full rounded-card" />
          <Skeleton className="h-full rounded-card" />
        </div>
      ) : shift.error ? (
        <div className="p-6">
          <ErrorBanner
            title="Couldn't load your shift"
            message={errorMessage(shift.error)}
            onRetry={() => void shift.refetch()}
          />
        </div>
      ) : !shift.data ? (
        <OpenShiftCard />
      ) : (
        <>
          {/* A branch switch starts that branch's own cart. */}
          <PosScreen
            key={branch?.id}
            heldOpen={heldOpen}
            onHeldOpen={() => setHeldOpen(true)}
            onHeldClose={() => setHeldOpen(false)}
          />
          <CloseShiftDialog
            shift={shift.data}
            open={closing}
            onClose={() => setClosing(false)}
            onExit={() => navigate("/")}
          />
        </>
      )}
    </div>
  );
}

function PosHeader({
  shift,
  onHeld,
  onCloseShift,
  onHelp,
}: {
  shift: ShiftReport | null;
  onHeld: () => void;
  onCloseShift: () => void;
  onHelp: () => void;
}) {
  const { me } = useAuth();
  const held = useHeldCarts();
  const hint = (key: string, label: string) => (
    <span className="hidden items-center gap-1.5 xl:inline-flex">
      <Kbd dark>{key}</Kbd>
      <span className="text-helper text-white/70">{label}</span>
    </span>
  );
  const headerButton =
    "inline-flex h-8 items-center gap-1.5 rounded-input px-2.5 text-body font-medium text-white hover:bg-white/10";

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 bg-navy-900 px-4 text-white">
      <Link to="/" className="inline-flex items-center gap-1 text-body font-medium text-white/80 hover:text-white">
        <ChevronLeft className="size-4" /> Exit POS
      </Link>
      <Logo className="size-8" />
      <p className="min-w-0 truncate text-body">
        <span className="font-semibold">POS billing</span>
        {shift && <span className="text-white/70"> · {shift.counter}</span>}
        {me && <span className="text-white/70"> · {`${me.user.firstName} ${me.user.lastName}`}</span>}
      </p>
      <div className="ml-auto flex items-center gap-4">
        {shift && (
          <span className="hidden items-center gap-1.5 text-helper text-white/70 md:inline-flex">
            <Clock className="size-3.5" /> Shift opened {timeFmt.format(new Date(shift.openedAt))}
          </span>
        )}
        {hint("F3", "Search")}
        {hint("F4", "Exact cash")}
        {hint("F8", "Hold")}
        {hint("F12", "Charge")}
        <button type="button" onClick={onHelp} className={headerButton} title="Keyboard shortcuts (F1)">
          <Keyboard className="size-4" /> Shortcuts <Kbd dark>F1</Kbd>
        </button>
        {shift && (
          <>
            <button type="button" onClick={onHeld} className={headerButton}>
              <PauseCircle className="size-4" /> Held
              {held.data?.length ? <CountBadge tone="highlight">{held.data.length}</CountBadge> : null}
            </button>
            <button type="button" onClick={onCloseShift} className={headerButton}>
              <Power className="size-4" /> Close shift
            </button>
          </>
        )}
      </div>
    </header>
  );
}

interface PendingApproval {
  payments: PaymentRow[];
  approvals: string[];
  message: string;
}

function PosScreen({
  heldOpen,
  onHeldOpen,
  onHeldClose,
}: {
  heldOpen: boolean;
  onHeldOpen: () => void;
  onHeldClose: () => void;
}) {
  const { branch, can } = useAuth();
  const branchId = branch?.id ?? "none";
  const toast = useToast();
  const settings = useSettings().data;
  const [cart, dispatch] = useReducer(cartReducer, branchId, loadCart);
  const [chosenMode, setMode] = useState<PosMode | null>(null);
  const [paying, setPaying] = useState(false);
  const [holding, setHolding] = useState(false);
  const [pending, setPending] = useState<PendingApproval | null>(null);
  const [resumeAsk, setResumeAsk] = useState<HeldCart | null>(null);
  const [resumingId, setResumingId] = useState<string | null>(null);
  // The bill just charged (dialog open) and the last one, for "Reprint last bill".
  const [savedBill, setSavedBill] = useState<SavedBill | null>(null);
  const [lastBill, setLastBill] = useState<SavedBill | null>(null);
  const printFormat: PrintFormat = settings?.print.defaultFormat ?? "A4";
  const printBill = (bill: SavedBill, format: PrintFormat = printFormat) =>
    printInBackground(invoicePrintPath(bill.invoice.id, paramFor(format)));
  const search = useRef<HTMLInputElement>(null);
  const customerInput = useRef<HTMLInputElement>(null);
  // Keyboard line selection and the cart dialogs F9 / Shift+F9 / F10 open.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [lineDiscountKey, setLineDiscountKey] = useState<string | null>(null);
  const [billDiscountOpen, setBillDiscountOpen] = useState(false);
  const [clearAsk, setClearAsk] = useState(false);
  const charge = useCharge();
  const hold = useHoldCart();

  useEffect(() => saveCart(branchId, cart), [branchId, cart]);
  // Attaching or removing the customer moves the cursor to the next step (product search, or the customer box).
  const customerId = cart.customer?.id ?? null;
  useEffect(() => {
    const t = setTimeout(() => (customerInput.current ?? search.current)?.focus(), 0);
    return () => clearTimeout(t);
  }, [customerId]);

  // Settings decide the default mode; credit always needs a customer.
  const preferred = chosenMode ?? settings?.pos.defaultPaymentMode ?? "CASH";
  const mode: PosMode = preferred === "CREDIT" && !cart.customer ? "CASH" : preferred;

  // Every bill starts with the customer: while none is attached the customer box takes the cursor,
  // afterwards the product search does. (The customer input is unmounted once someone is attached.)
  const focusSearch = () => setTimeout(() => (customerInput.current ?? search.current)?.focus(), 0);
  const needCustomer = () => {
    if (cart.customer) return false;
    toast({ message: "Enter the customer's mobile number or email first (F7)", tone: "error" });
    customerInput.current?.focus();
    return true;
  };
  // A removed line can't stay selected.
  const selected = cart.lines.some((l) => lineKey(l) === selectedKey) ? selectedKey : null;

  // Instant totals with the shared engine; the debounced server quote confirms them.
  const placeOfSupply = cart.customer?.stateCode ?? cart.customer?.gstin?.slice(0, 2) ?? branch?.stateCode ?? null;
  const supplyType = supplyTypeFor(branch?.stateCode ?? "", placeOfSupply);
  const totals = useMemo(
    () =>
      priceCart(
        cart.lines.map((l) => ({
          quantity: qtyOf(l),
          rate: l.rate,
          gstRate: l.gstRate,
          taxInclusive: l.taxInclusive,
          discount: l.discount,
        })),
        cart.billDiscount,
        supplyType,
      ),
    [cart.lines, cart.billDiscount, supplyType],
  );
  const body = useMemo(() => toCartBody(cart), [cart]);
  const debouncedBody = useDebounced(body, 400);
  const quote = useQuote(debouncedBody.lines.length ? debouncedBody : null);

  const maxPct = settings?.pos.maxDiscountPercent ?? quote.data?.maxDiscountPercent ?? 100;
  const overLimit = totals.discountBasisPoints > Math.round(maxPct * 100) && !can("discount.override");
  const approvalNote =
    overLimit || (quote.data?.needsDiscountApproval && !quote.isPlaceholderData)
      ? `Discount above your ${maxPct}% limit — a manager will approve it at charge.`
      : null;
  const serverIssues = quote.data && !quote.isPlaceholderData ? quote.data.issues.map((i) => i.message) : [];

  const inCart = useMemo(() => new Map(cart.lines.map((l) => [`${l.kind}:${l.id}`, qtyOf(l)])), [cart.lines]);

  const add = (line: Omit<CartLine, "quantity" | "discount">) => {
    if (needCustomer()) return;
    dispatch({ type: "add", line });
    focusSearch();
  };

  const onScan = async (code: string) => {
    if (needCustomer()) return;
    try {
      add(itemToLine(await api.get<ItemSearchResult>(`/items/by-barcode/${encodeURIComponent(code)}`)));
    } catch (err) {
      const message = err instanceof ApiError && err.status === 404 ? `No item has barcode ${code}` : errorMessage(err);
      toast({ message, tone: "error" });
    }
  };

  // Resume a held cart: re-price it on the server for names, rates and stock, then load it.
  const resume = async (held: HeldCart) => {
    setResumeAsk(null);
    setResumingId(held.id);
    try {
      // Only the cart fields: /pos/quote is strict and rejects anything else (e.g. the hold label).
      const { customerId, lines: heldLines, billDiscount } = held.cart;
      const q = await api.post<Quote>("/pos/quote", { customerId, lines: heldLines, billDiscount });
      const source = heldLines as { discount?: number }[];
      const lines: CartLine[] = q.lines.map((l, i) => ({
        kind: l.kind,
        id: (l.itemId ?? l.labourServiceId)!,
        name: l.description,
        sku: l.sku,
        unit: l.unit,
        rate: Number(l.rate),
        gstRate: l.gstRate,
        taxInclusive: l.taxInclusive,
        quantity: String(Number(l.quantity)),
        discount: Number(source[i]?.discount ?? 0),
        available: l.available === null ? null : Number(l.available),
      }));
      dispatch({
        type: "load",
        lines,
        customer: q.customer,
        billDiscount: held.cart.billDiscount ?? null,
        heldCartId: held.id,
      });
      onHeldClose();
      toast({ message: `Resumed ${held.label || held.customerName || "held cart"}` });
    } catch (err) {
      toast({ message: errorMessage(err), tone: "error" });
    } finally {
      setResumingId(null);
      focusSearch();
    }
  };

  const submit = async (payments: PaymentRow[], override?: { identifier: string; password: string }) => {
    try {
      const invoice = await charge.mutateAsync({
        key: cart.idempotencyKey,
        body: {
          ...body,
          payments,
          expectedTotal: totals.totalPaise / 100,
          heldCartId: cart.heldCartId ?? undefined,
          override,
        },
      });
      setPaying(false);
      setPending(null);
      dispatch({ type: "clear" });
      // Change handed back for cash tendered above the amount.
      const changePaise = payments
        .filter((p) => p.mode === "CASH" && p.tendered != null)
        .reduce((s, p) => s + Math.max(Math.round(((p.tendered ?? 0) - p.amount) * 100), 0), 0);
      const bill: SavedBill = { invoice, changePaise };
      setSavedBill(bill);
      setLastBill(bill);
      if (settings?.pos.autoPrintAfterCharge) printBill(bill);
    } catch (err) {
      if (err instanceof ApiError && err.code === "APPROVAL_REQUIRED") {
        const approvals = (err.details as { approvals?: string[] } | undefined)?.approvals ?? [];
        setPaying(false);
        setPending({ payments, approvals, message: err.message });
        if (override) toast({ message: err.message, tone: "error" });
        return;
      }
      // 409: prices changed, not enough stock or no shift; show why and refresh the quote.
      if (err instanceof ApiError && err.status === 409) void quote.refetch();
      toast({ message: errorMessage(err), tone: "error" });
    }
  };

  const openPayment = () => {
    if (needCustomer()) return;
    if (!cart.lines.length || totals.issues.length || charge.isPending || paying) return;
    if (!cart.lines.every((l) => qtyOf(l) > 0)) {
      toast({ message: "Every line needs a quantity", tone: "error" });
      return;
    }
    setPaying(true);
  };

  const holdCart = async (label: string) => {
    try {
      await hold.mutateAsync({ ...body, label: label || null });
      dispatch({ type: "clear" });
      setHolding(false);
      toast({ message: "Cart held" });
      focusSearch();
    } catch (err) {
      toast({ message: errorMessage(err), tone: "error" });
    }
  };

  // ---------- Keyboard shortcuts (see ./shortcuts.ts; F1 shows them) ----------
  const keys = { skipInDialogs: true };
  const keyIndex = cart.lines.findIndex((l) => lineKey(l) === selected);
  const selectAt = (i: number) => {
    const line = cart.lines[Math.min(Math.max(i, 0), cart.lines.length - 1)];
    setSelectedKey(line ? lineKey(line) : null);
  };
  const toNavigation = () => {
    (document.activeElement as HTMLElement | null)?.blur();
    selectAt(0);
  };
  const notOnButton = (e: KeyboardEvent) => !(e.target as HTMLElement | null)?.closest("button, a");

  // Exact cash: the whole total in cash, no payment dialog.
  const exactCash = () => {
    if (!cart.lines.length || totals.issues.length || charge.isPending || paying) return;
    if (!cart.lines.every((l) => qtyOf(l) > 0)) {
      toast({ message: "Every line needs a quantity", tone: "error" });
      return;
    }
    void submit([{ mode: "CASH", amount: totals.totalPaise / 100, tendered: null, reference: null }]);
  };

  const newBill = () => {
    if (cart.lines.length || cart.customer) setClearAsk(true);
    else focusSearch();
  };

  const modeKey = (i: number) => () => {
    const m = MODES[i];
    if (m.value === "CREDIT" && !cart.customer) toast({ message: "Add the customer (F7) first to let them pay later" });
    else setMode(m.value);
  };
  const hasLines = () => cart.lines.length > 0;
  const hasSelection = () => Boolean(selected);

  useHotkey("f3", () => search.current?.focus(), keys);
  useHotkey("slash", () => search.current?.focus(), keys);
  useHotkey("f4", exactCash, keys);
  useHotkey("f6", onHeldOpen, keys);
  useHotkey(
    "f7",
    () => {
      if (cart.customer) toast({ message: `${cart.customer.name} is attached. Use Change to pick another.` });
      else customerInput.current?.focus();
    },
    keys,
  );
  useHotkey(
    "f8",
    () => {
      if (cart.lines.length) setHolding(true);
    },
    keys,
  );
  useHotkey(
    "f9",
    () => {
      if (cart.lines.length) setBillDiscountOpen(true);
    },
    keys,
  );
  useHotkey(
    "shift+f9",
    () => {
      if (selected) setLineDiscountKey(selected);
      else if (cart.lines.length) toast({ message: "Select a line first with ↑ / ↓" });
    },
    keys,
  );
  useHotkey("f10", newBill, keys);
  useHotkey("f12", openPayment, keys);
  useHotkey(
    "mod+p",
    () => {
      if (lastBill) printBill(lastBill);
      else toast({ message: "No bill to reprint yet" });
    },
    keys,
  );
  useHotkey("alt+1", modeKey(0), keys);
  useHotkey("alt+2", modeKey(1), keys);
  useHotkey("alt+3", modeKey(2), keys);
  useHotkey("alt+4", modeKey(3), keys);
  useHotkey("down", () => selectAt(selected ? keyIndex + 1 : 0), { ...keys, when: hasLines });
  useHotkey("up", () => selectAt(selected ? keyIndex - 1 : cart.lines.length - 1), { ...keys, when: hasLines });
  useHotkey("plus", () => selected && dispatch({ type: "step", key: selected, delta: 1 }), {
    ...keys,
    when: hasSelection,
  });
  useHotkey("minus", () => selected && dispatch({ type: "step", key: selected, delta: -1 }), {
    ...keys,
    when: hasSelection,
  });
  useHotkey(
    "delete",
    () => {
      if (!selected) return;
      dispatch({ type: "remove", key: selected });
      // Move to the next line (or the previous one at the end).
      const rest = cart.lines.filter((l) => lineKey(l) !== selected);
      const next = rest[Math.min(keyIndex, rest.length - 1)];
      setSelectedKey(next ? lineKey(next) : null);
      if (!next) focusSearch();
    },
    { ...keys, when: hasSelection },
  );
  useHotkey(
    "enter",
    () => {
      const input = document.querySelector<HTMLInputElement>(`[data-qty="${selected}"]`);
      input?.focus();
      input?.select();
    },
    { ...keys, when: (e) => hasSelection() && notOnButton(e) },
  );
  useHotkey(
    "escape",
    () => {
      setSelectedKey(null);
      focusSearch();
    },
    keys,
  );

  const dialogs = (
    <>
      <BillSavedDialog
        bill={savedBill}
        format={printFormat}
        onPrint={(format) => {
          // Print and move straight on to the next bill; "Reprint" under the cart prints it again.
          if (savedBill) printBill(savedBill, format);
          setSavedBill(null);
          focusSearch();
        }}
        onNext={() => {
          setSavedBill(null);
          focusSearch();
        }}
      />
      <PaymentDialog
        open={paying}
        totalPaise={totals.totalPaise}
        mode={mode}
        customer={cart.customer}
        busy={charge.isPending}
        onClose={() => {
          setPaying(false);
          focusSearch();
        }}
        onConfirm={(payments) => void submit(payments)}
      />
      <OverrideDialog
        open={Boolean(pending)}
        message={pending?.message ?? ""}
        approvals={pending?.approvals ?? []}
        busy={charge.isPending}
        onClose={() => setPending(null)}
        onSubmit={(override) => {
          if (pending) void submit(pending.payments, override);
        }}
      />
      <HoldDialog
        open={holding}
        busy={hold.isPending}
        onClose={() => setHolding(false)}
        onHold={(label) => void holdCart(label)}
      />
      <HeldCartsDialog
        open={heldOpen}
        resuming={resumingId}
        onClose={onHeldClose}
        onResume={(held) => (cart.lines.length ? setResumeAsk(held) : void resume(held))}
      />
      <ConfirmDialog
        open={clearAsk}
        title="Start a new bill?"
        body="The items and customer on screen will be cleared. Hold the bill first (F8) if you still need it."
        cancelLabel="Keep this bill"
        confirmLabel="Clear and start new"
        onClose={() => setClearAsk(false)}
        onConfirm={() => {
          dispatch({ type: "clear" });
          setClearAsk(false);
          setSelectedKey(null);
          focusSearch();
        }}
      />
      <ConfirmDialog
        open={Boolean(resumeAsk)}
        destructive={false}
        title="Replace the current cart?"
        body="The cart on screen will be cleared. Hold it first (F8) if you still need it."
        cancelLabel="Keep current cart"
        confirmLabel="Resume held cart"
        onClose={() => setResumeAsk(null)}
        onConfirm={() => resumeAsk && void resume(resumeAsk)}
      />
    </>
  );

  // Step 1: no customer yet, so the screen only asks who the bill is for. Step 2 (below): billing.
  if (!cart.customer) {
    return (
      <main className="flex min-h-0 flex-1 flex-col bg-canvas">
        <CustomerStep
          inputRef={customerInput}
          waitingItems={cart.lines.length}
          onAttach={(customer) => dispatch({ type: "setCustomer", customer })}
          onHeld={onHeldOpen}
          reprint={lastBill ? { number: lastBill.invoice.number, onPrint: () => printBill(lastBill) } : undefined}
        />
        {dialogs}
      </main>
    );
  }

  return (
    <main className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:overflow-hidden">
      <section className="flex min-h-[60vh] flex-col lg:min-h-0" aria-label="Products">
        <ProductPane
          ref={search}
          inCart={inCart}
          onAdd={add}
          onScan={onScan}
          onArrowDownEmpty={cart.lines.length ? toNavigation : undefined}
        />
      </section>
      <div className="flex min-h-0 flex-col">
        <CartPanel
          cart={cart}
          dispatch={dispatch}
          totals={totals}
          supplyType={supplyType}
          approvalNote={approvalNote}
          serverIssues={serverIssues}
          mode={mode}
          onMode={setMode}
          onCharge={openPayment}
          charging={charge.isPending}
          selectedKey={selected}
          onSelect={setSelectedKey}
          lineDiscountKey={lineDiscountKey}
          onLineDiscount={setLineDiscountKey}
          billDiscountOpen={billDiscountOpen}
          onBillDiscount={setBillDiscountOpen}
        />
        <div className="mt-2 flex justify-between gap-2">
          <Button variant="ghost" size="sm" disabled={!cart.lines.length} onClick={() => setHolding(true)}>
            Hold cart (F8)
          </Button>
          {lastBill && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Printer className="size-4" />}
              onClick={() => printBill(lastBill)}
              title={`Print ${lastBill.invoice.number} again (Ctrl+P)`}
            >
              Reprint {lastBill.invoice.number}
            </Button>
          )}
          <Button variant="ghost" size="sm" disabled={!cart.lines.length && !cart.customer} onClick={newBill}>
            New bill (F10)
          </Button>
        </div>
      </div>

      {dialogs}
    </main>
  );
}
