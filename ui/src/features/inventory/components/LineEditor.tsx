import { Trash2 } from "lucide-react";
import { formatQty } from "@erp-software/shared";
import { Input } from "@/components/ui/Field";
import { ApiError } from "@/lib/api-client";
import type { ItemDetail, ItemSearchResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ItemPicker } from "./ItemPicker";
import { qtyWithUnit } from "./common";

export interface DraftLine {
  item: ItemSearchResult;
  // Kept as typed text so "-", "1." etc. can be edited; parsed on submit.
  quantity: string;
}

// Item lines for adjustments and transfers: pick parts, type quantities, remove rows.
// `signed` allows negative quantities (adjustments); otherwise quantities must be positive (transfers).
export function LineEditor({
  lines,
  onChange,
  signed,
  errors = {},
}: {
  lines: DraftLine[];
  onChange: (lines: DraftLine[]) => void;
  signed?: boolean;
  // Keyed by line index.
  errors?: Record<number, string>;
}) {
  const update = (i: number, quantity: string) => onChange(lines.map((l, j) => (j === i ? { ...l, quantity } : l)));
  const remove = (i: number) => onChange(lines.filter((_, j) => j !== i));

  return (
    <div className="space-y-4">
      <ItemPicker
        exclude={lines.map((l) => l.item.id)}
        onSelect={(item) => onChange([...lines, { item, quantity: signed ? "" : "1" }])}
      />
      {lines.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full text-body">
            <thead>
              <tr className="border-b border-border">
                <th className="eyebrow h-10 px-4 text-left font-semibold text-slate">Item</th>
                <th className="eyebrow h-10 px-4 text-right font-semibold text-slate">Available</th>
                <th className="eyebrow h-10 w-44 px-4 text-right font-semibold text-slate">
                  {signed ? "Change (+/−)" : "Quantity"}
                </th>
                {signed && <th className="eyebrow h-10 px-4 text-right font-semibold text-slate">After</th>}
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const available = Number(l.item.stock?.available ?? 0);
                const qty = Number(l.quantity);
                const after = available + (Number.isFinite(qty) ? qty : 0);
                return (
                  <tr key={l.item.id} className="border-b border-border align-top last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{l.item.name}</p>
                      <p className="text-helper text-slate">
                        <span className="font-mono">{l.item.sku}</span>
                        {l.item.brandName && ` · ${l.item.brandName}`}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right text-slate tabular">{qtyWithUnit(available, l.item.unit)}</td>
                    <td className="px-4 py-2">
                      <Input
                        aria-label={`Quantity for ${l.item.name}`}
                        aria-invalid={errors[i] ? true : undefined}
                        inputMode="decimal"
                        align="right"
                        placeholder={signed ? "e.g. −2 or 5" : "0"}
                        value={l.quantity}
                        onChange={(e) => update(i, e.target.value.replace("−", "-"))}
                        suffix={l.item.unit}
                      />
                      {errors[i] && <p className="mt-1 text-right text-helper text-danger">{errors[i]}</p>}
                    </td>
                    {signed && (
                      <td
                        className={cn(
                          "px-4 py-3 text-right tabular",
                          after < 0 ? "font-semibold text-danger" : "text-ink",
                        )}
                      >
                        {Number.isFinite(qty) && l.quantity !== "" ? formatQty(after) : "—"}
                      </td>
                    )}
                    <td className="px-2 py-2.5 text-right">
                      <button
                        type="button"
                        aria-label={`Remove ${l.item.name}`}
                        onClick={() => remove(i)}
                        className="inline-flex size-8 items-center justify-center rounded-input text-slate hover:bg-danger-50 hover:text-danger"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Client-side checks before posting; the server re-validates everything.
export function lineErrors(lines: DraftLine[], signed: boolean): Record<number, string> {
  const errors: Record<number, string> = {};
  lines.forEach((l, i) => {
    const raw = l.quantity.trim();
    const n = Number(raw);
    if (!raw || !Number.isFinite(n)) errors[i] = "Enter a quantity";
    else if (n === 0) errors[i] = "Can't be 0";
    else if (!signed && n < 0) errors[i] = "Must be more than 0";
    else if (Math.round(n * 1000) !== n * 1000 && Math.abs(Math.round(n * 1000) - n * 1000) > 1e-6)
      errors[i] = "At most 3 decimals";
  });
  return errors;
}

// The picker works with search results; an item opened from its detail page is converted to that shape.
export function toSearchResult(item: ItemDetail): ItemSearchResult {
  return {
    id: item.id,
    sku: item.sku,
    name: item.name,
    oemPartNo: item.oemPartNo,
    brandName: item.brand?.name ?? null,
    hsnCode: item.hsnCode,
    gstRate: item.gstRate,
    unit: item.unit,
    mrp: item.mrp,
    salePrice: item.salePrice,
    taxInclusive: item.taxInclusive,
    exact: false,
    stock: item.stock && {
      onHand: item.stock.onHand,
      reserved: item.stock.reserved,
      available: item.stock.available,
      status: item.stock.status,
    },
  };
}

// Maps "lines.2.quantity" style server errors onto line indexes.
export function serverLineErrors(err: unknown): { lines: Record<number, string>; fields: Record<string, string> } {
  const lines: Record<number, string> = {};
  const fields: Record<string, string> = {};
  if (err instanceof ApiError) {
    for (const [key, message] of Object.entries(err.fieldErrors)) {
      const m = /^lines\.(\d+)/.exec(key);
      if (m) lines[Number(m[1])] = message;
      else fields[key] = message;
    }
  }
  return { lines, fields };
}
