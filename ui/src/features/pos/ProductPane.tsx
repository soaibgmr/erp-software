import { forwardRef, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2, PackageSearch, Search, Wrench } from "lucide-react";
import { formatINR, formatQty } from "@automobile/shared";
import { useAuth } from "@/app/auth";
import { Chip } from "@/components/ui/Controls";
import { Input } from "@/components/ui/Field";
import { EmptyState, ErrorBanner, Skeleton } from "@/components/ui/States";
import { useCatalog } from "@/features/inventory/api";
import { api } from "@/lib/api-client";
import { useDebounced } from "@/lib/hooks";
import type { Item, LabourService } from "@/lib/types";
import { cn, errorMessage } from "@/lib/utils";
import { isScan, type CartLine } from "./cart";

type NewLine = Omit<CartLine, "quantity" | "discount">;

export const itemToLine = (i: {
  id: string;
  name: string;
  sku: string;
  unit: string;
  salePrice: string;
  gstRate: number;
  taxInclusive: boolean;
  stock: { available: string } | null;
}): NewLine => ({
  kind: "ITEM",
  id: i.id,
  name: i.name,
  sku: i.sku,
  unit: i.unit,
  rate: Number(i.salePrice),
  gstRate: i.gstRate,
  taxInclusive: i.taxInclusive,
  available: i.stock ? Number(i.stock.available) : 0,
});

const labourToLine = (l: LabourService): NewLine => ({
  kind: "LABOUR",
  id: l.id,
  name: l.name,
  sku: l.code,
  unit: "SVC",
  rate: Number(l.rate),
  gstRate: l.gstRate,
  taxInclusive: false,
  available: null,
});

const LABOUR = "LABOUR";

// Left pane: scanner-friendly search, category chips and the product grid (M5.2, M5.3).
export const ProductPane = forwardRef<
  HTMLInputElement,
  {
    inCart: Map<string, number>;
    onAdd: (line: NewLine) => void;
    onScan: (code: string) => Promise<void>;
    /** ↓ in an empty search box: hand the keyboard to the cart lines. */
    onArrowDownEmpty?: () => void;
  }
>(function ProductPane({ inCart, onAdd, onScan, onArrowDownEmpty }, searchRef) {
  const { branch } = useAuth();
  const [text, setText] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const keyTimes = useRef<number[]>([]);
  const q = useDebounced(text.trim(), 200);
  const categories = useCatalog("categories");
  const showLabour = category === LABOUR;

  const items = useQuery({
    queryKey: ["pos-items", branch?.id, q, category],
    queryFn: ({ signal }) =>
      api.list<Item>(
        "/items",
        { search: q || undefined, categoryId: category || undefined, isActive: true, limit: 48 },
        signal,
      ),
    enabled: !showLabour,
    placeholderData: keepPreviousData,
  });
  const labour = useQuery({
    queryKey: ["pos-labour", q],
    queryFn: ({ signal }) =>
      api.list<LabourService>("/labour-services", { search: q || undefined, isActive: true, limit: 48 }, signal),
    enabled: showLabour,
    placeholderData: keepPreviousData,
  });
  const query = showLabour ? labour : items;
  const rows = showLabour ? labour.data?.data : items.data?.data;

  const onKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key.length === 1) {
      const now = performance.now();
      const last = keyTimes.current.at(-1);
      // A gap starts a new burst; only the latest burst decides whether this was a scan.
      keyTimes.current = last !== undefined && now - last < 30 ? [...keyTimes.current, now] : [now];
      return;
    }
    if (e.key === "ArrowDown" && !text.trim() && onArrowDownEmpty) {
      e.preventDefault();
      onArrowDownEmpty();
      return;
    }
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = text.trim();
    const scanned = isScan(keyTimes.current);
    keyTimes.current = [];
    if (!code) return;
    if (scanned) {
      setScanning(true);
      try {
        await onScan(code);
      } finally {
        setScanning(false);
        setText("");
      }
      return;
    }
    const first = rows?.[0];
    if (first) {
      onAdd(showLabour ? labourToLine(first as LabourService) : itemToLine(first as Item));
      setText("");
    }
  };

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-slate" />
        <Input
          ref={searchRef}
          autoFocus
          aria-label="Scan a barcode or search parts"
          placeholder="Scan a barcode, or search name, SKU, OEM no.   (F3 or /)"
          className="h-12 pl-11 text-card"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => void onKeyDown(e)}
        />
        {(scanning || query.isFetching) && (
          <Loader2 className="absolute top-1/2 right-3.5 size-5 -translate-y-1/2 animate-spin text-slate" aria-hidden />
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Categories">
        <Chip selected={category === null} onClick={() => setCategory(null)}>
          All
        </Chip>
        {categories.data?.map((c) => (
          <Chip key={c.id} selected={category === c.id} onClick={() => setCategory(c.id)}>
            {c.name}
          </Chip>
        ))}
        <Chip selected={showLabour} onClick={() => setCategory(showLabour ? null : LABOUR)}>
          <Wrench className="mr-1.5 size-4" aria-hidden />
          Labour
        </Chip>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {query.error && !rows ? (
          <ErrorBanner
            title="Couldn't load products"
            message={errorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        ) : !rows ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} className="h-36 rounded-card" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title={q ? `Nothing matches “${q}”` : showLabour ? "No labour services yet" : "No items in this category"}
            description={q ? "Try the SKU, the OEM number, or scan the barcode." : undefined}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {showLabour
              ? (rows as LabourService[]).map((l) => (
                  <Tile
                    key={l.id}
                    overline="Labour"
                    name={l.name}
                    sku={l.code ?? `SAC ${l.sacCode}`}
                    price={l.rate}
                    qty={inCart.get(`LABOUR:${l.id}`)}
                    onClick={() => onAdd(labourToLine(l))}
                  />
                ))
              : (rows as Item[]).map((i) => {
                  const available = Number(i.stock?.available ?? 0);
                  const min = Number(i.stock?.minLevel ?? 0);
                  const out = available <= 0;
                  const low = !out && available <= Math.max(min, 3);
                  return (
                    <Tile
                      key={i.id}
                      overline={i.category?.name ?? i.brand?.name ?? "Part"}
                      name={i.name}
                      sku={i.sku}
                      price={i.salePrice}
                      qty={inCart.get(`ITEM:${i.id}`)}
                      disabled={out}
                      stock={
                        out ? (
                          <span className="text-muted">Out of stock</span>
                        ) : low ? (
                          <span className="font-medium text-warning">Only {formatQty(available)} left</span>
                        ) : (
                          <span className="text-slate">{formatQty(available)} in stock</span>
                        )
                      }
                      onClick={() => onAdd(itemToLine(i))}
                    />
                  );
                })}
          </div>
        )}
      </div>
    </div>
  );
});

function Tile({
  overline,
  name,
  sku,
  price,
  stock,
  qty,
  disabled,
  onClick,
}: {
  overline: string;
  name: string;
  sku: string;
  price: string;
  stock?: React.ReactNode;
  qty?: number;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative flex min-h-36 flex-col rounded-card border bg-surface p-4 text-left transition-colors",
        qty ? "border-navy-700 ring-1 ring-navy-700" : "border-border hover:border-navy-600 hover:bg-navy-50",
        disabled && "cursor-not-allowed opacity-60 hover:border-border hover:bg-surface",
      )}
    >
      {qty ? (
        <span className="absolute top-2.5 right-2.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-yellow-500 px-1.5 text-overline font-bold text-navy-900 tabular">
          {formatQty(qty)}
        </span>
      ) : null}
      <span className="eyebrow truncate pr-8 text-slate">{overline}</span>
      <span className="mt-1 line-clamp-2 text-body font-semibold text-ink">{name}</span>
      <span className="mt-0.5 truncate font-mono text-overline text-slate">{sku}</span>
      <span className="mt-auto flex items-end justify-between gap-2 pt-3">
        <span className="text-card font-bold text-ink tabular">{formatINR(price, { exact: true })}</span>
        {stock && <span className="text-overline">{stock}</span>}
      </span>
    </button>
  );
}
