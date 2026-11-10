import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { formatINR } from "@automobile/shared";
import { Input } from "@/components/ui/Field";
import { useDebounced } from "@/lib/hooks";
import type { ItemSearchResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useItemSearch } from "../api";
import { qtyWithUnit, StockBadge } from "./common";

// Search-as-you-type part picker (name, SKU, OEM number, brand or barcode).
// Enter picks the highlighted row, so a barcode scanner that ends with Enter adds the exact match.
export function ItemPicker({
  onSelect,
  placeholder = "Search parts by name, SKU, OEM no. or scan a barcode",
  exclude = [],
  autoFocus,
}: {
  onSelect: (item: ItemSearchResult) => void;
  placeholder?: string;
  exclude?: string[];
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const q = useDebounced(text.trim(), 200);
  const query = useItemSearch(q);
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const results = (query.data ?? []).filter((r) => !exclude.includes(r.id));

  useEffect(() => {
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pick = (item: ItemSearchResult | undefined) => {
    if (!item) return;
    onSelect(item);
    setText("");
    setOpen(false);
  };

  const showList = open && q.length >= 2;

  return (
    <div ref={root} className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate" />
      <Input
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Search parts"
        autoFocus={autoFocus}
        className="pl-9"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {query.isFetching && (
        <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-slate" aria-hidden />
      )}
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-menu border border-border bg-surface p-1.5 shadow-menu"
        >
          {query.isPending && !query.data ? (
            <li className="px-3 py-2 text-helper text-slate">Searching…</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-helper text-slate">No parts match “{q}”</li>
          ) : (
            results.map((r, i) => (
              <li
                key={r.id}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(r);
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-[6px] px-3 py-2",
                  i === active && "bg-navy-50",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-medium text-ink">{r.name}</p>
                  <p className="truncate text-helper text-slate">
                    <span className="font-mono">{r.sku}</span>
                    {r.brandName && ` · ${r.brandName}`}
                    {r.oemPartNo && ` · OEM ${r.oemPartNo}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-helper text-ink tabular">{formatINR(r.salePrice, { exact: true })}</p>
                  {r.stock && (
                    <p className="text-overline text-slate tabular">{qtyWithUnit(r.stock.available, r.unit)} avail.</p>
                  )}
                </div>
                {r.stock && <StockBadge status={r.stock.status} />}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
