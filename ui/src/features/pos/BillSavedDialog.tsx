import { useEffect, useRef } from "react";
import { CheckCircle2, Printer } from "lucide-react";
import {
  formatINR,
  INVOICE_STATUS_LABELS,
  PRINT_FORMAT_INFO,
  PRINT_FORMATS,
  type PrintFormat,
} from "@erp-software/shared";
import { useHotkey } from "@/app/hotkeys";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { InvoiceDetail } from "@/lib/types";

export interface SavedBill {
  invoice: InvoiceDetail;
  changePaise: number;
}

const inr = (v: string | number) => formatINR(v, { exact: true });

// Shown after every charge so printing is one key away. Enter (or P) prints in the global paper size from
// Settings; the other sizes are one click; N or Esc starts the next bill. Printing stays on the POS screen.
export function BillSavedDialog({
  bill,
  format,
  onPrint,
  onNext,
}: {
  bill: SavedBill | null;
  format: PrintFormat;
  onPrint: (format: PrintFormat) => void;
  onNext: () => void;
}) {
  const open = Boolean(bill);
  const primary = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => primary.current?.focus(), 0);
  }, [open]);

  useHotkey("p", () => onPrint(format), { enabled: open });
  useHotkey("n", onNext, { enabled: open });

  if (!bill) return null;
  const inv = bill.invoice;
  const due = Number(inv.balanceDue);

  return (
    <Modal open={open} onClose={onNext} title="Bill saved" size="md">
      <div className="flex items-start gap-4">
        <CheckCircle2 className="mt-1 size-8 shrink-0 text-success" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-section font-semibold text-ink">
            Invoice <span className="font-mono">{inv.number}</span>
          </p>
          <p className="text-body text-slate">
            {inv.customerName ?? "Walk-in customer"} · {INVOICE_STATUS_LABELS[inv.status]}
          </p>
        </div>
        <div className="text-right">
          <p className="text-helper text-slate">Total</p>
          <p className="text-kpi font-bold text-ink tabular">{inr(inv.grandTotal)}</p>
        </div>
      </div>

      {(bill.changePaise > 0 || due > 0) && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {bill.changePaise > 0 && (
            <div className="rounded-card bg-yellow-100 px-4 py-3">
              <p className="text-helper text-yellow-700">Give change</p>
              <p className="text-section font-bold text-navy-900 tabular">{inr(bill.changePaise / 100)}</p>
            </div>
          )}
          {due > 0 && (
            <div className="rounded-card bg-warning-50 px-4 py-3">
              <p className="text-helper text-warning">Dues (pay later)</p>
              <p className="text-section font-bold text-warning tabular">{inr(due)}</p>
            </div>
          )}
        </div>
      )}

      <Button
        ref={primary}
        variant="accent"
        size="lg"
        className="mt-6 w-full"
        icon={<Printer className="size-5" />}
        onClick={() => onPrint(format)}
      >
        Print bill · {PRINT_FORMAT_INFO[format].label}
        <kbd className="ml-2 rounded border border-current/30 px-1.5 text-overline opacity-70">Enter</kbd>
      </Button>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-helper text-slate">Other size:</span>
        {PRINT_FORMATS.filter((f) => f !== format).map((f) => (
          <Button key={f} variant="outline" size="sm" onClick={() => onPrint(f)}>
            {PRINT_FORMAT_INFO[f].short}
          </Button>
        ))}
        <Button variant="ghost" className="ml-auto" onClick={onNext}>
          Next bill <kbd className="ml-1 rounded border border-border px-1 text-overline text-slate">N</kbd>
        </Button>
      </div>
      <p className="mt-2 text-helper text-slate">
        Prints here and closes; use “Reprint” under the cart for another copy. Change the default in Settings → Billing
        &amp; tax.
      </p>
    </Modal>
  );
}
