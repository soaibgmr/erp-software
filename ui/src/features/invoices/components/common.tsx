import { NavLink } from "react-router";
import {
  INVOICE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PRINT_FORMAT_INFO,
  PRINT_FORMATS,
  type PrintFormat,
  type PrintParam,
  type InvoiceStatus,
  type PaymentMethod,
  type Permission,
} from "@erp-software/shared";
import { useAuth } from "@/app/auth";
import { Badge, type Tone } from "@/components/ui/Badge";
import { invoicePrintPath, openPrintTab } from "@/lib/print";
import { cn } from "@/lib/utils";

export const invoiceStatusTone: Record<InvoiceStatus, Tone> = {
  PAID: "success",
  PARTIALLY_PAID: "info",
  UNPAID: "warning",
  OVERDUE: "danger",
  CANCELLED: "neutral",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge tone={invoiceStatusTone[status]}>{INVOICE_STATUS_LABELS[status]}</Badge>;
}

export const paymentLabel = (mode: PaymentMethod) => PAYMENT_METHOD_LABELS[mode];

// Opens the print view in a new tab. Without a format it uses the global paper size from Settings.
export function openInvoicePrint(id: string, format?: PrintParam) {
  openPrintTab(invoicePrintPath(id, format));
}

// "Print" menu entries: the global paper size first, then the other sizes.
export function printMenuItems(id: string, defaultFormat: PrintFormat | undefined) {
  const first = defaultFormat ?? "A4";
  return [first, ...PRINT_FORMATS.filter((f) => f !== first)].map((f) => ({
    label: f === first ? `${PRINT_FORMAT_INFO[f].label} (default)` : PRINT_FORMAT_INFO[f].label,
    onSelect: () => openInvoicePrint(id, PRINT_FORMAT_INFO[f].param),
  }));
}

const TABS: { to: string; label: string; permissions: Permission[]; end?: boolean }[] = [
  { to: "/invoices", label: "Invoices", permissions: ["invoice.view", "invoice.create"], end: true },
  { to: "/invoices/credit-notes", label: "Credit notes", permissions: ["invoice.view", "invoice.create"] },
  { to: "/invoices/shifts", label: "Shifts", permissions: ["pos.use", "report.view"] },
];

// Horizontal tabs under the Invoices page header.
export function InvoicesTabs() {
  const { can } = useAuth();
  return (
    <nav
      aria-label="Invoices"
      className="-mt-2 mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {TABS.filter((t) => can(...t.permissions)).map((t) => (
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
