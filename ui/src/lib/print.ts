import { PRINT_FORMAT_INFO, type PrintFormat, type PrintParam } from "@automobile/shared";

// Bill printing. The paper size comes from Settings → Billing & tax → Invoice printing (print.defaultFormat),
// so every screen prints the same way; passing a format overrides it for one print.

export type InvoicePrintFormat = PrintParam;

// Without `format` the print page applies the global setting itself.
export const invoicePrintPath = (id: string, format?: PrintParam) =>
  `/print/invoice/${id}${format ? `?format=${format}` : ""}`;

export const paramFor = (format: PrintFormat | undefined): PrintParam => PRINT_FORMAT_INFO[format ?? "A4"].param;

// Opens the print view in a new tab.
export function openPrintTab(path: string) {
  window.open(path, "_blank", "noopener");
}

// Prints without leaving the current screen: the print page loads in a hidden iframe and calls
// window.print() itself once its data is in (?autoprint=1).
let frame: HTMLIFrameElement | null = null;

export function printInBackground(path: string) {
  frame?.remove();
  const url = new URL(path, window.location.origin);
  url.searchParams.set("autoprint", "1");

  frame = document.createElement("iframe");
  frame.title = "Print";
  frame.setAttribute("aria-hidden", "true");
  // Off-screen but laid out (a display:none frame can print blank in some browsers).
  Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  frame.src = url.pathname + url.search;
  document.body.appendChild(frame);
}
