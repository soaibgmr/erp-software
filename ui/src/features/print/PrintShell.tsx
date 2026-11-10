import { useEffect, useRef, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { stateName, type PrintParam } from "@erp-software/shared";
import { Logo } from "@/app/AppShell";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/States";
import type { Branch, Business } from "@/lib/types";
import { cn, errorMessage } from "@/lib/utils";

export type PaperSize = PrintParam;

const PAGE_CSS: Record<PaperSize, string> = {
  a4: "@page { size: A4; margin: 12mm; }",
  a5: "@page { size: A5; margin: 8mm; }",
  thermal: "@page { size: 80mm auto; margin: 3mm; }",
  thermal58: "@page { size: 58mm auto; margin: 2mm; }",
};

const SHEET: Record<PaperSize, string> = {
  a4: "w-full max-w-[210mm] p-[12mm] print:max-w-none print:p-0",
  a5: "w-full max-w-[148mm] p-[8mm] print:max-w-none print:p-0",
  thermal: "w-[80mm] p-[3mm] print:p-0",
  thermal58: "w-[58mm] p-[2mm] print:p-0",
};

// A5 and 58 mm reuse the A4 and 80 mm layouts scaled to the narrower paper (printable width ratio).
const ZOOM: Partial<Record<PaperSize, number>> = { a5: 0.71, thermal58: 0.73 };

export const isReceipt = (size: PaperSize) => size === "thermal" || size === "thermal58";

// Print views render outside the app shell. The toolbar is screen-only; @page sets the paper.
export function PrintShell({
  size,
  toolbar,
  loading,
  error,
  onRetry,
  children,
}: {
  size: PaperSize;
  toolbar?: ReactNode;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const autoPrint = params.get("autoprint") === "1";
  const printed = useRef(false);

  // ?autoprint=1 (used by the POS's background print): print once the document has rendered.
  const ready = !loading && !error && Boolean(children);
  useEffect(() => {
    if (!autoPrint || !ready || printed.current) return;
    printed.current = true;
    // Let fonts and layout settle so the first page isn't printed half-styled.
    const t = setTimeout(() => {
      void document.fonts?.ready.then(() => window.print());
    }, 150);
    return () => clearTimeout(t);
  }, [autoPrint, ready]);

  return (
    <div className="min-h-screen bg-canvas print:bg-surface">
      <style>{`${PAGE_CSS[size]} @media print { body { background: var(--color-surface); } }`}</style>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-3 print:hidden">
        <Button variant="ghost" size="sm" icon={<ArrowLeft className="size-4" />} onClick={() => navigate(-1)}>
          Back
        </Button>
        <div className="flex-1">{toolbar}</div>
        <Button
          size="sm"
          icon={<Printer className="size-4" />}
          onClick={() => window.print()}
          disabled={loading || Boolean(error)}
        >
          Print
        </Button>
      </div>
      <div className="px-4 py-6 print:p-0">
        {loading ? (
          <div className="flex justify-center py-24 text-slate" role="status">
            <Loader2 className="size-6 animate-spin" aria-label="Loading" />
          </div>
        ) : error ? (
          <div className="mx-auto max-w-lg">
            <ErrorBanner title="Couldn't load this document" message={errorMessage(error)} onRetry={onRetry} />
          </div>
        ) : (
          <div className={cn("relative mx-auto bg-surface text-ink shadow-modal print:shadow-none", SHEET[size])}>
            <div style={ZOOM[size] ? { zoom: ZOOM[size] } : undefined}>{children}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export const joinAddress = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(", ");

// GSTIN printed on documents: the branch's own registration, else the business's.
export const sellerGstin = (business: Business, branch: Branch) => branch.gstin ?? business.gstin;

// Logo tile + business block on the left, document title on the right; yellow 4 px rule on top.
export function DocumentHeader({
  business,
  branch,
  title,
  subtitle,
}: {
  business: Business;
  branch: Branch;
  title: string;
  subtitle?: string;
}) {
  const name = business.tradeName ?? business.legalName;
  const businessAddress = joinAddress(business.address, business.city, business.pincode);
  const branchAddress = joinAddress(branch.address, branch.city, branch.pincode);
  const gstin = sellerGstin(business, branch);
  return (
    <>
      <div className="-mx-[12mm] -mt-[12mm] mb-6 h-1 bg-yellow-500 print:mx-0 print:mt-0" aria-hidden />
      <header className="flex items-start justify-between gap-6">
        <div className="flex gap-3">
          <Logo className="size-11" />
          <div className="text-helper leading-snug">
            <p className="text-section font-bold text-navy-900">{name}</p>
            {business.tradeName && business.tradeName !== business.legalName && (
              <p className="text-slate">{business.legalName}</p>
            )}
            {businessAddress && <p className="text-slate">{businessAddress}</p>}
            {branchAddress && branchAddress !== businessAddress && (
              <p className="text-slate">
                {branch.name}: {branchAddress}
              </p>
            )}
            <p className="text-slate">
              {[gstin && `GSTIN ${gstin}`, `State ${branch.stateCode} · ${stateName(branch.stateCode) ?? ""}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="text-slate">{[branch.phone ?? business.phone, business.email].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-page font-bold tracking-wide text-navy-900">{title}</p>
          {subtitle && <p className="text-helper text-slate">{subtitle}</p>}
        </div>
      </header>
    </>
  );
}

// Diagonal watermark for cancelled documents.
export function Watermark({ text }: { text: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden>
      <span className="-rotate-30 text-[96px] font-black tracking-widest text-danger/15 select-none">{text}</span>
    </div>
  );
}

export function SignatureRow({
  businessName,
  signatureLabel,
}: {
  businessName: string;
  signatureLabel?: string | null;
}) {
  return (
    <div className="mt-10 flex items-end justify-between gap-6 text-helper">
      <div className="w-56 border-t border-border pt-1.5 text-slate">Customer signature</div>
      <div className="w-56 text-right">
        <p className="mb-10 font-semibold text-ink">For {businessName}</p>
        <div className="border-t border-border pt-1.5 text-slate">{signatureLabel || "Authorised signatory"}</div>
      </div>
    </div>
  );
}

export function DocumentFooter({ text, kind = "document" }: { text?: string | null; kind?: string }) {
  return (
    <footer className="mt-6 border-t border-border pt-3 text-center text-helper text-slate">
      {text && <p className="font-medium text-ink">{text}</p>}
      <p className="mt-0.5">Computer-generated {kind} · Page 1 of 1</p>
    </footer>
  );
}

// Overline-styled label used in the bordered info boxes.
export function BoxLabel({ children }: { children: ReactNode }) {
  return <p className="eyebrow mb-1 font-semibold text-slate">{children}</p>;
}
