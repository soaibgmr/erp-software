import { useParams, useSearchParams } from "react-router";
import {
  formatINR,
  formatMobile,
  formatQty,
  PAYMENT_METHOD_LABELS,
  PRINT_FORMAT_INFO,
  PRINT_FORMATS,
  printFormatFromParam,
  stateName,
} from "@automobile/shared";
import { SegmentedControl } from "@/components/ui/Controls";
import { useInvoicePrint } from "@/features/invoices/api";
import { useSettings } from "@/features/settings/api";
import type { InvoicePrint } from "@/lib/types";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import {
  BoxLabel,
  DocumentFooter,
  DocumentHeader,
  joinAddress,
  PrintShell,
  sellerGstin,
  SignatureRow,
  isReceipt,
  Watermark,
  type PaperSize,
} from "./PrintShell";

const inr = (v: string | number) => formatINR(v, { exact: true });

// /print/invoice/:id?format=a4|a5|thermal|thermal58 — the tax invoice (PRD M6.1) on A4 or A5, or a counter
// receipt (M6.2) on 80 or 58 mm paper. Without ?format= it uses the global paper size from Settings.
export function InvoicePrintPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const settings = useSettings();
  const query = useInvoicePrint(id);

  const requested = printFormatFromParam(params.get("format"));
  const size: PaperSize = PRINT_FORMAT_INFO[requested ?? settings.data?.print.defaultFormat ?? "A4"].param;

  return (
    <PrintShell
      size={size}
      loading={query.isPending}
      error={query.error}
      onRetry={() => query.refetch()}
      toolbar={
        <SegmentedControl<PaperSize>
          label="Paper size"
          value={size}
          onChange={(v) => setParams({ format: v }, { replace: true })}
          options={PRINT_FORMATS.map((f) => ({ value: PRINT_FORMAT_INFO[f].param, label: PRINT_FORMAT_INFO[f].short }))}
        />
      }
    >
      {query.data &&
        (isReceipt(size) ? (
          <ThermalReceipt data={query.data} footerText={settings.data?.print.footerText} />
        ) : (
          <A4Invoice data={query.data} print={settings.data?.print} />
        ))}
    </PrintShell>
  );
}

type PrintSettings =
  { invoiceTerms: string | null; footerText: string | null; signatureLabel: string | null } | undefined;

function A4Invoice({ data, print }: { data: InvoicePrint; print: PrintSettings }) {
  const { invoice: inv, business, branch, amountInWords, taxSummary } = data;
  const igst = inv.supplyType === "INTER_STATE";
  const cancelled = inv.status === "CANCELLED";
  const payments = inv.payments;
  const hasDiscount = Number(inv.discountTotal) > 0;
  const name = business.tradeName ?? business.legalName;

  return (
    <article className="relative text-body">
      {cancelled && <Watermark text="CANCELLED" />}
      <DocumentHeader business={business} branch={branch} title="TAX INVOICE" subtitle="Original for recipient" />

      {cancelled && (
        <p className="mt-4 rounded-input border border-danger-100 bg-danger-50 px-3 py-2 text-helper text-danger">
          Cancelled {formatDateTime(inv.cancelledAt)}
          {inv.cancelReason && ` · ${inv.cancelReason}`}
        </p>
      )}

      {/* Bill to · Vehicle · Invoice meta */}
      <section className="mt-6 grid grid-cols-3 divide-x divide-border rounded-input border border-border text-helper">
        <div className="p-3">
          <BoxLabel>Bill to</BoxLabel>
          <p className="font-semibold text-ink">{inv.customerName ?? "Walk-in customer"}</p>
          {inv.customerMobile && <p className="text-slate">{formatMobile(inv.customerMobile)}</p>}
          {inv.customerGstin && <p className="text-slate">GSTIN {inv.customerGstin}</p>}
          {inv.customerAddress && <p className="text-slate">{inv.customerAddress}</p>}
        </div>
        <div className="p-3">
          <BoxLabel>Vehicle</BoxLabel>
          <p className="text-slate">—</p>
        </div>
        <div className="space-y-0.5 p-3">
          <BoxLabel>Invoice</BoxLabel>
          <Meta label="Invoice no." value={<span className="font-semibold text-ink">{inv.number}</span>} />
          <Meta label="Date" value={formatDate(inv.invoiceDate)} />
          {inv.dueDate && <Meta label="Due" value={formatDate(inv.dueDate)} />}
          <Meta label="Place of supply" value={`${inv.placeOfSupply} · ${stateName(inv.placeOfSupply) ?? ""}`} />
          <Meta label="Supply" value={igst ? "Inter-state (IGST)" : "Intra-state"} />
        </div>
      </section>

      {/* Lines */}
      <table className="mt-6 w-full border-collapse text-helper">
        <thead>
          <tr className="bg-navy-50 text-left">
            <Th className="w-8">#</Th>
            <Th>Description</Th>
            <Th>HSN/SAC</Th>
            <Th right>Qty</Th>
            <Th right>Rate</Th>
            {hasDiscount && <Th right>Disc.</Th>}
            <Th right>GST %</Th>
            <Th right>Taxable value</Th>
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l) => (
            <tr key={l.id} className="border-b border-border align-top">
              <Td>{l.lineNo}</Td>
              <Td>
                <p className="font-medium text-ink">{l.description}</p>
                {l.sku && <p className="font-mono text-overline text-slate">{l.sku}</p>}
              </Td>
              <Td>{l.hsnSac ?? "—"}</Td>
              <Td right>
                {formatQty(l.quantity)}
                {l.unit !== "PCS" && l.unit !== "SVC" ? ` ${l.unit}` : ""}
              </Td>
              <Td right>
                {inr(l.rate)}
                {l.taxInclusive && <span className="block text-overline text-slate">incl. GST</span>}
              </Td>
              {hasDiscount && <Td right>{Number(l.discount) > 0 ? inr(l.discount) : "—"}</Td>}
              <Td right>{l.gstRate}%</Td>
              <Td right>{inr(l.taxable)}</Td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-6 grid grid-cols-[minmax(0,1fr)_260px] gap-6">
        <div className="space-y-4">
          {/* HSN-wise tax summary */}
          <table className="w-full border-collapse text-overline">
            <thead>
              <tr className="bg-navy-50 text-left">
                <Th>HSN/SAC</Th>
                <Th right>GST %</Th>
                <Th right>Taxable</Th>
                {igst ? (
                  <Th right>IGST</Th>
                ) : (
                  <>
                    <Th right>CGST</Th>
                    <Th right>SGST</Th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {taxSummary.map((t) => (
                <tr key={`${t.hsnSac}-${t.gstRate}`} className="border-b border-border">
                  <Td>{t.hsnSac ?? "—"}</Td>
                  <Td right>{t.gstRate}%</Td>
                  <Td right>{inr(t.taxable)}</Td>
                  {igst ? (
                    <Td right>{inr(t.igst)}</Td>
                  ) : (
                    <>
                      <Td right>{inr(t.cgst)}</Td>
                      <Td right>{inr(t.sgst)}</Td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="text-helper">
            <BoxLabel>Amount in words</BoxLabel>
            <p className="font-medium text-ink">{amountInWords}</p>
          </div>

          {payments.length > 0 && (
            <div className="text-helper">
              <BoxLabel>Payment details</BoxLabel>
              <ul className="space-y-0.5">
                {payments.map((p) => (
                  <li key={p.id} className="flex justify-between gap-4">
                    <span className="text-slate">
                      {PAYMENT_METHOD_LABELS[p.mode]}
                      {p.kind !== "RECEIPT" && ` (${p.kind === "REFUND" ? "refund" : "reversal"})`}
                      {p.reference && ` · Ref ${p.reference}`} · {formatDate(p.receivedAt)}
                    </span>
                    <span className="tabular text-ink">{inr(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(business.bankAccountNo || business.upiId) && (
            <div className="text-helper">
              <BoxLabel>Bank details</BoxLabel>
              {business.bankAccountNo && (
                <p className="text-slate">
                  {[
                    business.bankName,
                    `A/c ${business.bankAccountNo}`,
                    business.bankIfsc && `IFSC ${business.bankIfsc}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {business.upiId && <p className="text-slate">UPI {business.upiId}</p>}
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="text-helper">
          <TotalRow label="Taxable value" value={inr(inv.taxableTotal)} />
          {hasDiscount && <TotalRow label="Discount included" value={inr(inv.discountTotal)} muted />}
          {igst ? (
            <TotalRow label="IGST" value={inr(inv.igstTotal)} />
          ) : (
            <>
              <TotalRow label="CGST" value={inr(inv.cgstTotal)} />
              <TotalRow label="SGST" value={inr(inv.sgstTotal)} />
            </>
          )}
          <TotalRow label="Round off" value={inr(inv.roundOff)} />
          <div className="my-2 flex items-center justify-between rounded-input bg-navy-900 px-3 py-2.5 text-white print:[print-color-adjust:exact]">
            <span className="font-semibold">Total</span>
            <span className="text-card font-bold tabular">{inr(inv.grandTotal)}</span>
          </div>
          <TotalRow label="Paid" value={inr(inv.paidTotal)} />
          {Number(inv.creditedTotal) > 0 && <TotalRow label="Credit notes" value={inr(inv.creditedTotal)} />}
          <TotalRow label="Balance due" value={inr(inv.balanceDue)} strong />
        </div>
      </section>

      {print?.invoiceTerms && (
        <section className="mt-6 text-helper">
          <BoxLabel>Terms</BoxLabel>
          <p className="whitespace-pre-line text-slate">{print.invoiceTerms}</p>
        </section>
      )}

      <SignatureRow businessName={name} signatureLabel={print?.signatureLabel} />
      <DocumentFooter text={print?.footerText} kind="invoice" />
    </article>
  );
}

function ThermalReceipt({ data, footerText }: { data: InvoicePrint; footerText?: string | null }) {
  const { invoice: inv, business, branch } = data;
  const igst = inv.supplyType === "INTER_STATE";
  const gstin = sellerGstin(business, branch);
  const change = inv.payments
    .filter((p) => p.mode === "CASH" && p.tendered)
    .reduce((s, p) => s + Number(p.tendered) - Number(p.amount), 0);
  const rule = <hr className="my-1.5 border-dashed border-ink/40" />;

  return (
    <article className="relative font-mono text-[11px] leading-tight text-ink">
      {inv.status === "CANCELLED" && <p className="mb-1 text-center font-bold">*** CANCELLED ***</p>}
      <div className="text-center">
        <p className="text-[13px] font-bold">{business.tradeName ?? business.legalName}</p>
        <p>
          {joinAddress(
            branch.address ?? business.address,
            branch.city ?? business.city,
            branch.pincode ?? business.pincode,
          )}
        </p>
        {gstin && <p>GSTIN {gstin}</p>}
        {(branch.phone ?? business.phone) && <p>Ph {branch.phone ?? business.phone}</p>}
        <p className="mt-1 font-bold">TAX INVOICE</p>
      </div>
      {rule}
      <Row l={inv.number} r={formatDateTime(inv.invoiceDate)} />
      {inv.createdBy && <Row l="Cashier" r={inv.createdBy.name} />}
      {inv.customerName && <Row l={inv.customerName} r={inv.customerMobile ? formatMobile(inv.customerMobile) : ""} />}
      {inv.customerGstin && <Row l="GSTIN" r={inv.customerGstin} />}
      {rule}
      {inv.lines.map((l) => (
        <div key={l.id} className="mb-1">
          <p>{l.description}</p>
          <Row
            l={`  ${formatQty(l.quantity)} × ${inr(l.rate)}${Number(l.discount) > 0 ? ` −${inr(l.discount)}` : ""}`}
            r={inr(l.total)}
          />
        </div>
      ))}
      {rule}
      <Row l="Taxable" r={inr(inv.taxableTotal)} />
      {igst ? (
        <Row l="IGST" r={inr(inv.igstTotal)} />
      ) : (
        <>
          <Row l="CGST" r={inr(inv.cgstTotal)} />
          <Row l="SGST" r={inr(inv.sgstTotal)} />
        </>
      )}
      <Row l="Round off" r={inr(inv.roundOff)} />
      <Row l={<b className="text-[13px]">TOTAL</b>} r={<b className="text-[13px]">{inr(inv.grandTotal)}</b>} />
      {rule}
      {inv.payments.map((p) => (
        <Row
          key={p.id}
          l={`${PAYMENT_METHOD_LABELS[p.mode]}${p.kind !== "RECEIPT" ? ` (${p.kind.toLowerCase()})` : ""}`}
          r={inr(p.amount)}
        />
      ))}
      {change > 0 && <Row l="Change" r={inr(change)} />}
      {Number(inv.balanceDue) > 0 && <Row l={<b>Balance due</b>} r={<b>{inr(inv.balanceDue)}</b>} />}
      {rule}
      <p className="text-center">{footerText || "Thank you for your business."}</p>
    </article>
  );
}

function Row({ l, r }: { l: React.ReactNode; r: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="min-w-0">{l}</span>
      <span className="shrink-0 text-right tabular">{r}</span>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <p className="flex justify-between gap-2">
      <span className="text-slate">{label}</span>
      <span className="text-right">{value}</span>
    </p>
  );
}

function Th({ children, right, className }: { children: React.ReactNode; right?: boolean; className?: string }) {
  return (
    <th
      className={cn(
        "eyebrow px-2 py-2 font-semibold text-slate print:[print-color-adjust:exact]",
        right && "text-right",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <td className={cn("px-2 py-1.5", right && "text-right tabular whitespace-nowrap")}>{children}</td>;
}

function TotalRow({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={cn("flex justify-between py-0.5", strong && "font-semibold text-ink", muted && "text-slate")}>
      <span className={strong ? "" : "text-slate"}>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}
