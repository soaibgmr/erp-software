import { useQueries } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { formatINR, priceWithTax } from "@erp-software/shared";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { ErrorBanner, Skeleton } from "@/components/ui/States";
import { api } from "@/lib/api-client";
import type { ItemDetail } from "@/lib/types";
import { errorMessage } from "@/lib/utils";
import { Barcode } from "../components/Barcode";

const MAX_COPIES = 500;

// ?items=<id>:<copies>,<id>:<copies>
function parseItems(raw: string | null): { id: string; copies: number }[] {
  return (raw ?? "")
    .split(",")
    .map((part) => {
      const [id = "", n] = part.split(":");
      return { id: id.trim(), copies: Math.min(Math.max(Math.round(Number(n ?? 1)) || 1, 1), MAX_COPIES) };
    })
    .filter((x) => /^[0-9a-f-]{36}$/i.test(x.id));
}

// Barcode labels (about 50 × 25 mm) on A4 or a label roll, printed from the browser.
// Items without a manufacturer barcode get their SKU encoded instead.
export function LabelsPrintPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const entries = parseItems(params.get("items"));

  const queries = useQueries({
    queries: entries.map((e) => ({
      queryKey: ["inventory", "label-item", e.id],
      queryFn: ({ signal }: { signal: AbortSignal }) => api.get<ItemDetail>(`/items/${e.id}`, undefined, signal),
      staleTime: 60_000,
    })),
  });

  const setCopies = (id: string, copies: number) => {
    const next = entries.map((e) =>
      e.id === id ? { ...e, copies: Math.min(Math.max(copies || 1, 1), MAX_COPIES) } : e,
    );
    setParams({ items: next.map((e) => `${e.id}:${e.copies}`).join(",") }, { replace: true });
  };

  const loading = queries.some((q) => q.isPending);
  const failed = queries.find((q) => q.error);
  const total = entries.reduce((s, e) => s + e.copies, 0);

  return (
    <div className="min-h-screen bg-canvas print:bg-white">
      <style>{"@page { margin: 8mm; } @media print { body { background: white; } }"}</style>

      <div className="border-b border-border bg-surface px-4 py-4 sm:px-6 print:hidden">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-section font-semibold text-ink">Barcode labels</h1>
            <p className="text-helper text-slate">{total} labels · 50 × 25 mm. Set the printer to 100% scale.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" icon={<ArrowLeft className="size-4" />} onClick={() => navigate(-1)}>
              Back
            </Button>
            <Button
              icon={<Printer className="size-4" />}
              disabled={loading || !entries.length}
              onClick={() => window.print()}
            >
              Print
            </Button>
          </div>
        </div>
        {entries.length > 0 && (
          <ul className="mx-auto mt-4 grid max-w-[1100px] gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((e, i) => (
              <li key={e.id} className="flex items-center gap-3 rounded-input border border-border px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-body text-ink">
                  {queries[i]?.data?.name ?? "Loading…"}
                </span>
                <label className="flex items-center gap-2 text-helper text-slate">
                  Copies
                  <Input
                    type="number"
                    min={1}
                    max={MAX_COPIES}
                    align="right"
                    className="h-8 w-20"
                    value={e.copies}
                    onChange={(ev) => setCopies(e.id, Number(ev.target.value))}
                  />
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <main className="mx-auto max-w-[1100px] p-4 sm:p-6 print:max-w-none print:p-0">
        {!entries.length ? (
          <ErrorBanner title="No items to print" message="Open an item and choose Print labels." />
        ) : failed ? (
          <ErrorBanner
            title="Couldn't load an item"
            message={errorMessage(failed.error)}
            onRetry={() => queries.forEach((q) => q.refetch())}
          />
        ) : loading ? (
          <div className="grid grid-cols-[repeat(auto-fill,50mm)] gap-2">
            {Array.from({ length: Math.min(total, 12) }, (_, i) => (
              <Skeleton key={i} className="h-[25mm] w-[50mm] rounded-[4px]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,50mm)] gap-2 print:gap-[2mm]">
            {entries.flatMap((e, i) => {
              const item = queries[i]!.data!;
              return Array.from({ length: e.copies }, (_, n) => <Label key={`${e.id}-${n}`} item={item} />);
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function Label({ item }: { item: ItemDetail }) {
  const code = item.barcodes[0] ?? item.sku;
  return (
    <div className="flex h-[25mm] w-[50mm] break-inside-avoid flex-col overflow-hidden rounded-[4px] border border-border bg-white px-[2mm] py-[1.5mm] text-black print:rounded-none print:border-dashed">
      <p className="line-clamp-2 text-[8pt] leading-[1.15] font-semibold">{item.name}</p>
      <div className="mt-auto flex items-baseline justify-between gap-1 text-[7pt] leading-tight">
        <span className="truncate font-mono">{item.sku}</span>
        <span className="shrink-0 font-semibold whitespace-nowrap">
          {/* Shelf price includes GST. */}
          {formatINR(priceWithTax(Number(item.salePrice), item.gstRate, item.taxInclusive), { exact: true })}
          {item.mrp && <span className="ml-1 font-normal">MRP {formatINR(item.mrp, { exact: true })}</span>}
        </span>
      </div>
      <Barcode value={code} height={28} className="mt-[0.5mm]" />
    </div>
  );
}
