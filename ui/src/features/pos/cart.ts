import type { BillDiscount } from "@erp-software/shared";
import type { CartBody } from "@/features/invoices/api";
import type { CustomerCredit } from "@/lib/types";

// POS cart state: a reducer persisted to sessionStorage per branch, so a refresh doesn't lose a sale.

export interface CartLine {
  kind: "ITEM" | "LABOUR";
  id: string; // item or labour service id
  name: string;
  sku: string | null;
  unit: string;
  rate: number; // sale price (incl. GST when taxInclusive)
  gstRate: number;
  taxInclusive: boolean;
  // Kept as typed text so "1." or "" can be edited; parsed with qtyOf().
  quantity: string;
  discount: number; // ₹ on the line
  available: number | null; // null for labour
}

export interface CartState {
  lines: CartLine[];
  customer: CustomerCredit | null;
  billDiscount: BillDiscount | null;
  heldCartId: string | null;
  // One key per charge attempt, reused by retries until the charge succeeds; any cart change resets it.
  idempotencyKey: string;
}

export type CartAction =
  | { type: "add"; line: Omit<CartLine, "quantity" | "discount">; quantity?: number }
  | { type: "setQty"; key: string; quantity: string }
  | { type: "step"; key: string; delta: number }
  | { type: "setDiscount"; key: string; discount: number }
  | { type: "remove"; key: string }
  | { type: "setCustomer"; customer: CustomerCredit | null }
  | { type: "setBillDiscount"; billDiscount: BillDiscount | null }
  | {
      type: "load";
      lines: CartLine[];
      customer: CustomerCredit | null;
      billDiscount: BillDiscount | null;
      heldCartId: string | null;
    }
  | { type: "clear" };

export const lineKey = (l: Pick<CartLine, "kind" | "id">) => `${l.kind}:${l.id}`;

export const qtyOf = (l: Pick<CartLine, "quantity">) => {
  const n = Number(l.quantity);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) / 1000 : 0;
};

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `pos-${crypto.randomUUID()}`
    : `pos-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const emptyCart = (): CartState => ({
  lines: [],
  customer: null,
  billDiscount: null,
  heldCartId: null,
  idempotencyKey: newKey(),
});

const fmtQty = (n: number) => String(Math.round(n * 1000) / 1000);

export function cartReducer(state: CartState, action: CartAction): CartState {
  const changed = (s: Omit<CartState, "idempotencyKey">): CartState => ({ ...s, idempotencyKey: newKey() });
  const map = (key: string, fn: (l: CartLine) => CartLine) => state.lines.map((l) => (lineKey(l) === key ? fn(l) : l));

  switch (action.type) {
    case "add": {
      const key = lineKey(action.line);
      const qty = action.quantity ?? 1;
      const existing = state.lines.find((l) => lineKey(l) === key);
      const lines = existing
        ? map(key, (l) => ({ ...l, ...action.line, quantity: fmtQty(qtyOf(l) + qty) }))
        : [...state.lines, { ...action.line, quantity: fmtQty(qty), discount: 0 }];
      return changed({ ...state, lines });
    }
    case "setQty":
      return changed({ ...state, lines: map(action.key, (l) => ({ ...l, quantity: action.quantity })) });
    case "step": {
      const lines = state.lines
        .map((l) => (lineKey(l) === action.key ? { ...l, quantity: fmtQty(Math.max(qtyOf(l) + action.delta, 0)) } : l))
        .filter((l) => lineKey(l) !== action.key || qtyOf(l) > 0);
      return changed({ ...state, lines });
    }
    case "setDiscount":
      return changed({ ...state, lines: map(action.key, (l) => ({ ...l, discount: Math.max(action.discount, 0) })) });
    case "remove":
      return changed({ ...state, lines: state.lines.filter((l) => lineKey(l) !== action.key) });
    case "setCustomer":
      return changed({ ...state, customer: action.customer });
    case "setBillDiscount":
      return changed({ ...state, billDiscount: action.billDiscount });
    case "load":
      return changed({
        lines: action.lines,
        customer: action.customer,
        billDiscount: action.billDiscount,
        heldCartId: action.heldCartId,
      });
    case "clear":
      return emptyCart();
  }
}

// What the API needs: ids, quantities and discounts only. Prices come from the server's masters.
export function toCartBody(state: CartState): CartBody {
  return {
    customerId: state.customer?.id ?? null,
    lines: state.lines
      .filter((l) => qtyOf(l) > 0)
      .map((l) =>
        l.kind === "ITEM"
          ? { kind: "ITEM" as const, itemId: l.id, quantity: qtyOf(l), discount: l.discount }
          : { kind: "LABOUR" as const, labourServiceId: l.id, quantity: qtyOf(l), discount: l.discount },
      ),
    billDiscount: state.billDiscount && state.billDiscount.value > 0 ? state.billDiscount : null,
  };
}

// ---------- Persistence ----------

const storageKey = (branchId: string) => `ami.pos.cart.${branchId}`;

export function loadCart(branchId: string): CartState {
  try {
    const raw = sessionStorage.getItem(storageKey(branchId));
    if (!raw) return emptyCart();
    const parsed = JSON.parse(raw) as Partial<CartState>;
    if (!Array.isArray(parsed.lines)) return emptyCart();
    return { ...emptyCart(), ...parsed, lines: parsed.lines };
  } catch {
    return emptyCart();
  }
}

export function saveCart(branchId: string, state: CartState) {
  try {
    sessionStorage.setItem(storageKey(branchId), JSON.stringify(state));
  } catch {
    // Storage blocked or full: the cart still works for this page view.
  }
}

// ---------- Scanner detection ----------

// A barcode scanner types a burst of characters a few ms apart and ends with Enter.
// Given the timestamps (ms) of the characters before Enter, decide whether it was a scan.
export function isScan(keyTimes: number[], { minLength = 4, maxGapMs = 30 } = {}): boolean {
  if (keyTimes.length < minLength) return false;
  for (let i = 1; i < keyTimes.length; i++) {
    if (keyTimes[i]! - keyTimes[i - 1]! >= maxGapMs) return false;
  }
  return true;
}
