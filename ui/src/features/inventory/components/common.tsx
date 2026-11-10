import { NavLink } from "react-router";
import {
  formatQty,
  STOCK_STATUS_LABELS,
  type StockAdjustmentStatus,
  type StockStatus,
  type StockTransferStatus,
} from "@automobile/shared";
import type { Permission } from "@automobile/shared";
import { useAuth } from "@/app/auth";
import { Badge, type Tone } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export const stockTone: Record<StockStatus, Tone> = { IN_STOCK: "success", LOW: "warning", OUT: "danger" };

export function StockBadge({ status }: { status: StockStatus }) {
  return <Badge tone={stockTone[status]}>{STOCK_STATUS_LABELS[status]}</Badge>;
}

export const adjustmentStatusBadge: Record<StockAdjustmentStatus, { tone: Tone; label: string }> = {
  PENDING: { tone: "warning", label: "Awaiting approval" },
  POSTED: { tone: "success", label: "Posted" },
  REJECTED: { tone: "neutral", label: "Rejected" },
};

export const transferStatusBadge: Record<StockTransferStatus, { tone: Tone; label: string }> = {
  IN_TRANSIT: { tone: "info", label: "In transit" },
  RECEIVED: { tone: "success", label: "Received" },
  CANCELLED: { tone: "neutral", label: "Cancelled" },
};

// "12 PCS", "1.5 LTR"; the unit is dropped for pieces.
export const qtyWithUnit = (q: string | number, unit: string) =>
  unit === "PCS" ? formatQty(q) : `${formatQty(q)} ${unit}`;

// Signed quantity for ledgers and adjustments: "+5", "−2".
export function SignedQty({ value }: { value: string | number }) {
  const n = Number(value);
  return (
    <span className={cn("tabular font-medium", n > 0 ? "text-success" : n < 0 ? "text-danger" : "text-slate")}>
      {n > 0 ? "+" : n < 0 ? "−" : ""}
      {formatQty(Math.abs(n))}
    </span>
  );
}

export const INVENTORY_TABS: { to: string; label: string; permissions: Permission[]; end?: boolean }[] = [
  { to: "/inventory", label: "Stock", permissions: ["inventory.view", "inventory.manage"], end: true },
  { to: "/inventory/adjustments", label: "Adjustments", permissions: ["inventory.view", "inventory.manage"] },
  { to: "/inventory/transfers", label: "Transfers", permissions: ["inventory.view", "inventory.manage"] },
  { to: "/inventory/labour", label: "Labour services", permissions: ["inventory.view", "inventory.manage"] },
  { to: "/inventory/masters", label: "Categories & brands", permissions: ["inventory.manage"] },
];

// Horizontal tabs under the Inventory page header.
export function InventoryTabs() {
  const { can } = useAuth();
  return (
    <nav
      aria-label="Inventory"
      className="-mt-2 mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {INVENTORY_TABS.filter((t) => can(...t.permissions)).map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            cn(
              "flex h-10 shrink-0 items-center border-b-2 px-3 text-body font-medium whitespace-nowrap",
              isActive ? "border-yellow-500 text-navy-900" : "border-transparent text-slate hover:text-ink",
            )
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
