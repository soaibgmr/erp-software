import { Trash2 } from "lucide-react";
import { formatQty } from "@erp-software/shared";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import { ItemPicker } from "./ItemPicker";
import { qtyWithUnit } from "./format";
import type { DraftLine } from "./line-utils";

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
