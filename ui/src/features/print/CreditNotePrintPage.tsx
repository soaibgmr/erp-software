import { useParams } from "react-router";
import { formatINR, formatMobile, formatQty, stateName } from "@automobile/shared";
import { useCreditNote, useInvoicePrint } from "@/features/invoices/api";
import { useSettings } from "@/features/settings/api";
import { cn, formatDate } from "@/lib/utils";
import { BoxLabel, DocumentFooter, DocumentHeader, PrintShell, SignatureRow } from "./PrintShell";

const inr = (v: string | number) => formatINR(v, { exact: true });

// /print/credit-note/:id — A4 credit note against a posted invoice (PRD M6.6).
// Business, branch and customer come from the original invoice's print data.
export function CreditNotePrintPage() {
  const { id } = useParams();
  const note = useCreditNote(id);
  const original = useInvoicePrint(note.data?.invoice.id);
  const settings = useSettings();

  const loading = note.isPending || (Boolean(note.data) && original.isPending);
  const error = note.error ?? original.error;

  return (
    <PrintShell
      size="a4"
      loading={loading}
      error={error}
      onRetry={() => {
        void note.refetch();
        void original.refetch();
      }}
    >
      {note.data && original.data && (
        <CreditNoteDocument
          note={note.data}
          data={original.data}
          signatureLabel={settings.data?.print.signatureLabel}
          footerText={settings.data?.print.footerText}
        />
      )}
    </PrintShell>
  );
}

function CreditNoteDocument({
  note,
  data,
  signatureLabel,
  footerText,
}: {
  note: NonNullable<ReturnType<typeof useCreditNote>["data"]>;
  data: NonNullable<ReturnType<typeof useInvoicePrint>["data"]>;
  signatureLabel?: string | null;
  footerText?: string | null;
}) {
  const { invoice: inv, business, branch } = data;
  const igst = inv.supplyType === "INTER_STATE";

  return (
    <article className="text-body">
      <DocumentHeader business={business} branch={branch} title="CREDIT NOTE" subtitle="Original for recipient" />

      <section className="mt-6 grid grid-cols-3 divide-x divide-border rounded-input border border-border text-helper">
        <div className="p-3">
          <BoxLabel>Customer</BoxLabel>
          <p className="font-semibold text-ink">{inv.customerName ?? "Walk-in customer"}</p>
          {inv.customerMobile && <p className="text-slate">{formatMobile(inv.customerMobile)}</p>}
          {inv.customerGstin && <p className="text-slate">GSTIN {inv.customerGstin}</p>}
          {inv.customerAddress && <p className="text-slate">{inv.customerAddress}</p>}
        </div>
        <div className="space-y-0.5 p-3">
          <BoxLabel>Credit note</BoxLabel>
          <Meta label="Number" value={<span className="font-semibold text-ink">{note.number}</span>} />
          <Meta label="Date" value={formatDate(note.createdAt)} />
          <Meta label="Place of supply" value={`${inv.placeOfSupply} · ${stateName(inv.placeOfSupply) ?? ""}`} />
        </div>
        <div className="space-y-0.5 p-3">
          <BoxLabel>Against invoice</BoxLabel>
          <Meta label="Invoice no." value={<span className="font-semibold text-ink">{inv.number}</span>} />
          <Meta label="Invoice date" value={formatDate(inv.invoiceDate)} />
          <Meta label="Invoice total" value={inr(inv.grandTotal)} />
        </div>
      </section>

      <p className="mt-4 text-helper">
        <span className="text-slate">Reason: </span>
        <span className="text-ink">{note.reason}</span>
      </p>

      <table className="mt-4 w-full border-collapse text-helper">
        <thead>
          <tr className="bg-navy-50 text-left print:[print-color-adjust:exact]">
            <Th className="w-8">#</Th>
            <Th>Returned item</Th>
            <Th>HSN/SAC</Th>
            <Th right>Qty</Th>
            <Th right>Rate</Th>
            <Th right>GST %</Th>
            <Th right>Taxable</Th>
            <Th right>Tax</Th>
            <Th right>Amount</Th>
          </tr>
        </thead>
        <tbody>
          {note.lines.map((l, i) => (
            <tr key={l.invoiceLineId} className="border-b border-border align-top">
              <Td>{i + 1}</Td>
              <Td>
                <p className="font-medium text-ink">{l.description}</p>
                {l.sku && <p className="font-mono text-overline text-slate">{l.sku}</p>}
              </Td>
              <Td>{l.hsnSac ?? "—"}</Td>
              <Td right>{formatQty(l.quantity)}</Td>
              <Td right>{inr(l.rate)}</Td>
              <Td right>{l.gstRate}%</Td>
              <Td right>{inr(l.taxable)}</Td>
              <Td right>{inr(Number(l.cgst) + Number(l.sgst) + Number(l.igst))}</Td>
              <Td right>{inr(l.total)}</Td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-6 flex justify-end">
        <div className="w-[260px] text-helper">
          <TotalRow label="Taxable value" value={inr(note.taxableTotal)} />
          {igst ? (
            <TotalRow label="IGST" value={inr(note.igstTotal)} />
          ) : (
            <>
              <TotalRow label="CGST" value={inr(note.cgstTotal)} />
              <TotalRow label="SGST" value={inr(note.sgstTotal)} />
            </>
          )}
          <TotalRow label="Round off" value={inr(note.roundOff)} />
          <div className="my-2 flex items-center justify-between rounded-input bg-navy-900 px-3 py-2.5 text-white print:[print-color-adjust:exact]">
            <span className="font-semibold">Credit total</span>
            <span className="text-card font-bold tabular">{inr(note.total)}</span>
          </div>
          <TotalRow label="Refunded" value={inr(note.refunded)} />
          <TotalRow label="Adjusted against invoice" value={inr(Number(note.total) - Number(note.refunded))} />
        </div>
      </section>

      <SignatureRow businessName={business.tradeName ?? business.legalName} signatureLabel={signatureLabel} />
      <DocumentFooter text={footerText} kind="credit note" />
    </article>
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
    <th className={cn("eyebrow px-2 py-2 font-semibold text-slate", right && "text-right", className)}>{children}</th>
  );
}

function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <td className={cn("px-2 py-1.5", right && "text-right tabular whitespace-nowrap")}>{children}</td>;
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-slate">{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}
