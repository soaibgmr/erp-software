import { PRINT_FORMAT_INFO, PRINT_FORMATS, type PrintFormat, type PrintParam } from "@erp-software/shared";
import { invoicePrintPath, openPrintTab } from "@/lib/print";

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
