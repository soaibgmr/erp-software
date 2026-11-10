import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Package, Plus, Search, Upload } from "lucide-react";
import { formatINR, formatQty, type StockStatus } from "@automobile/shared";
import { useAuth } from "@/app/auth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip, PageHeader } from "@/components/ui/Controls";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Input, Select } from "@/components/ui/Field";
import { EmptyState, NoResults } from "@/components/ui/States";
import { useDebounced } from "@/lib/hooks";
import type { StockRow } from "@/lib/types";
import { useCatalog, useStock } from "../api";
import { InventoryTabs, StockBadge } from "../components/common";

const STATUS_CHIPS: { value: StockStatus | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "IN_STOCK", label: "In stock" },
  { value: "LOW", label: "Low stock" },
  { value: "OUT", label: "Out of stock" },
];

export function StockPage() {
  const navigate = useNavigate();
  const { can, me, branch } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page") ?? 1);
  const categoryId = params.get("categoryId") ?? undefined;
  const brandId = params.get("brandId") ?? undefined;
  const status = (params.get("status") as StockStatus | null) ?? undefined;
  const allBranches = params.get("branch") === "all";
  const [search, setSearch] = useState(params.get("search") ?? "");
  const debounced = useDebounced(search.trim());

  // Search lives in the URL so the command palette can deep-link and back/forward works.
  useEffect(() => {
    setParams(
      (p) => {
        if (debounced !== (p.get("search") ?? "")) p.delete("page");
        if (debounced) p.set("search", debounced);
        else p.delete("search");
        return p;
      },
      { replace: true },
    );
  }, [debounced, setParams]);

  const categories = useCatalog("categories");
  const brands = useCatalog("brands");
  const query = useStock({
    page,
    search: debounced || undefined,
    categoryId,
    brandId,
    status,
    branchId: allBranches ? "all" : undefined,
    sort: status === "LOW" || status === "OUT" ? "available" : "name",
  });
  const filtered = Boolean(debounced || categoryId || brandId || status);
  const manage = can("inventory.manage");

  const setParam = (key: string, value: string | undefined) =>
    setParams((p) => {
      if (value) p.set(key, value);
      else p.delete(key);
      if (key !== "page") p.delete("page");
      return p;
    });

  const qty = (v: string) => formatQty(v);

  const columns: Column<StockRow>[] = [
    {
      key: "item",
      header: "Item",
      cell: (r) => (
        <div className="min-w-0">
          <p className="font-medium text-navy-700">{r.name}</p>
          <p className="text-helper text-slate">
            <span className="font-mono">{r.sku}</span>
            {r.brandName && ` · ${r.brandName}`}
          </p>
        </div>
      ),
    },
    ...(allBranches
      ? [
          {
            key: "branch",
            header: "Branch",
            cell: (r: StockRow) => <span className="whitespace-nowrap">{r.branchName}</span>,
          },
        ]
      : []),
    { key: "category", header: "Category", cell: (r) => r.categoryName ?? <span className="text-muted">—</span> },
    {
      key: "bin",
      header: "Bin",
      cell: (r) =>
        r.binLocation ? (
          <span className="font-mono text-helper">{r.binLocation}</span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    { key: "onHand", header: "On hand", align: "right", cell: (r) => qty(r.onHand) },
    {
      key: "reserved",
      header: "Reserved",
      align: "right",
      cell: (r) => (Number(r.reserved) ? qty(r.reserved) : <span className="text-muted">0</span>),
    },
    {
      key: "available",
      header: "Available",
      align: "right",
      cell: (r) => <span className="font-semibold text-ink">{qty(r.available)}</span>,
    },
    {
      key: "min",
      header: "Min",
      align: "right",
      cell: (r) => (Number(r.minLevel) ? qty(r.minLevel) : <span className="text-muted">—</span>),
    },
    { key: "status", header: "Status", cell: (r) => <StockBadge status={r.status} /> },
    {
      key: "price",
      header: "Sale price",
      align: "right",
      cell: (r) => <span className="whitespace-nowrap">{formatINR(r.salePrice, { exact: true })}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Inventory"
        description={
          allBranches
            ? "Stock across every branch you can access."
            : `Parts and stock levels in ${branch?.name ?? "this branch"}.`
        }
        actions={
          manage && (
            <>
              {manage && (
                <>
                  <Button
                    variant="outline"
                    icon={<Upload className="size-4" />}
                    onClick={() => navigate("/inventory/import")}
                  >
                    Import
                  </Button>
                  <Button icon={<Plus className="size-4" />} onClick={() => navigate("/inventory/items/new")}>
                    New item
                  </Button>
                </>
              )}
            </>
          )
        }
      />
      <InventoryTabs />
      <Card>
        <div className="space-y-3 border-b border-border p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-60 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate" />
              <Input
                aria-label="Search parts"
                placeholder="Search name, SKU, OEM no., brand or barcode"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              aria-label="Category"
              className="w-48"
              value={categoryId ?? ""}
              onChange={(e) => setParam("categoryId", e.target.value || undefined)}
            >
              <option value="">All categories</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Brand"
              className="w-44"
              value={brandId ?? ""}
              onChange={(e) => setParam("brandId", e.target.value || undefined)}
            >
              <option value="">All brands</option>
              {brands.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            {me && me.branches.length > 1 && (
              <Select
                aria-label="Branches"
                className="w-44"
                value={allBranches ? "all" : ""}
                onChange={(e) => setParam("branch", e.target.value || undefined)}
              >
                <option value="">This branch</option>
                <option value="all">All branches</option>
              </Select>
            )}
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Stock status">
            {STATUS_CHIPS.map((c) => (
              <Chip key={c.label} selected={status === c.value} onClick={() => setParam("status", c.value)}>
                {c.label}
              </Chip>
            ))}
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={query.data?.data}
          rowKey={(r) => `${r.itemId}:${r.branchId}`}
          loading={query.isPending}
          error={query.error}
          onRetry={() => query.refetch()}
          onRowClick={(r) => navigate(`/inventory/items/${r.itemId}`)}
          empty={
            filtered ? (
              <NoResults
                query={debounced || undefined}
                hint="Try the SKU or OEM number, or clear the filters."
                onClear={() => {
                  setSearch("");
                  setParams({});
                }}
              />
            ) : (
              <EmptyState
                icon={Package}
                title={allBranches ? "No stock in any branch yet" : "No items yet"}
                description="Add parts one by one, or import your item list and opening stock from a CSV file."
                action={
                  manage && (
                    <div className="flex flex-wrap justify-center gap-3">
                      <Button variant="outline" onClick={() => navigate("/inventory/import")}>
                        Import from CSV
                      </Button>
                      <Button onClick={() => navigate("/inventory/items/new")}>New item</Button>
                    </div>
                  )
                }
              />
            )
          }
        />
        <Pagination meta={query.data?.meta} onPage={(p) => setParam("page", String(p))} />
      </Card>
    </>
  );
}
