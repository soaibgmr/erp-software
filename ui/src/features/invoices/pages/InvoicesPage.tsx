import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { FileText, Monitor, Search } from "lucide-react";
import {
  formatINR,
  formatMobile,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUSES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type InvoiceStatus,
  type PaymentMethod,
} from "@erp-software/shared";
import { useAuth } from "@/app/auth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip, PageHeader, SegmentedControl } from "@/components/ui/Controls";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Input, Select } from "@/components/ui/Field";
import { Menu } from "@/components/ui/Menu";
import { EmptyState, NoResults } from "@/components/ui/States";
import { useDebounced } from "@/lib/hooks";
import type { InvoiceSummary } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { useInvoices } from "../api";
import { CancelInvoiceDialog } from "../components/CancelInvoiceDialog";
import { InvoicesTabs, InvoiceStatusBadge, openInvoicePrint } from "../components/common";

const TZ = "Asia/Kolkata";
// Calendar day in the business timezone, as the API expects (YYYY-MM-DD).
const dayIn = (offsetDays = 0) =>
  new Date(Date.now() - offsetDays * 86_400_000).toLocaleDateString("en-CA", { timeZone: TZ });

type Range = "all" | "today" | "7d" | "30d" | "custom";
const RANGE_DAYS: Record<"today" | "7d" | "30d", number> = { today: 0, "7d": 6, "30d": 29 };

function rangeOf(from: string | undefined, to: string | undefined): Range {
  if (!from && !to) return "all";
  if (to === dayIn()) {
    for (const [k, d] of Object.entries(RANGE_DAYS)) if (from === dayIn(d)) return k as Range;
  }
  return "custom";
}

export function InvoicesPage() {
  const navigate = useNavigate();
  const { can, me } = useAuth();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const debounced = useDebounced(search.trim());
  const [cancelling, setCancelling] = useState<InvoiceSummary | null>(null);

  const page = Number(params.get("page") ?? 1);
  const status = (params.get("status") as InvoiceStatus | null) ?? undefined;
  const paymentMode = (params.get("paymentMode") as PaymentMethod | null) ?? undefined;
  const from = params.get("from") ?? undefined;
  const to = params.get("to") ?? undefined;
  const allBranches = params.get("branchId") === "all";
  const multiBranch = (me?.branches.length ?? 0) > 1;

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

  const setParam = (updates: Record<string, string | undefined>) =>
    setParams((p) => {
      for (const [k, v] of Object.entries(updates)) {
        if (v) p.set(k, v);
        else p.delete(k);
      }
      if (!("page" in updates)) p.delete("page");
      return p;
    });

  const query = useInvoices({
    page,
    search: debounced || undefined,
    status,
    paymentMode,
    from,
    to,
    branchId: allBranches ? "all" : undefined,
  });
  const filtered = Boolean(debounced || status || paymentMode || from || to);
  const rows = query.data?.data;
  const pageTotal = rows?.filter((r) => r.status !== "CANCELLED").reduce((s, r) => s + Number(r.grandTotal), 0) ?? 0;
  const pageDue = rows?.reduce((s, r) => s + Number(r.balanceDue), 0) ?? 0;

  const range = rangeOf(from, to);
  const setRange = (r: Range) => {
    if (r === "all") setParam({ from: undefined, to: undefined });
    else if (r !== "custom") setParam({ from: dayIn(RANGE_DAYS[r]), to: dayIn() });
  };

  const columns: Column<InvoiceSummary>[] = [
    {
      key: "number",
      header: "Invoice",
      cell: (i) => (
        <div className="min-w-0">
          <Link
            to={`/invoices/${i.id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-mono font-semibold text-navy-700 hover:underline"
          >
            {i.number}
          </Link>
          {i.kind === "OPENING_BALANCE" && <span className="ml-2 text-helper font-medium text-slate">Old dues</span>}
          <p className="truncate text-helper text-slate">
            {i.customerName
              ? `${i.customerName}${i.customerMobile ? ` · ${formatMobile(i.customerMobile)}` : ""}`
              : "Walk-in customer"}
          </p>
        </div>
      ),
    },
    ...(allBranches ? [{ key: "branch", header: "Branch", cell: (i: InvoiceSummary) => i.branch.name }] : []),
    {
      key: "date",
      header: "Date",
      cell: (i) => <span className="whitespace-nowrap text-slate">{formatDate(i.invoiceDate)}</span>,
    },
    { key: "items", header: "Items", align: "right", cell: (i) => i.itemCount },
    {
      key: "total",
      header: "Total",
      align: "right",
      cell: (i) => (
        <span className={cn(i.status === "CANCELLED" && "text-muted line-through")}>
          {formatINR(i.grandTotal, { exact: true })}
        </span>
      ),
    },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      cell: (i) =>
        Number(i.balanceDue) > 0 ? (
          <span className="font-semibold text-ink">{formatINR(i.balanceDue, { exact: true })}</span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    { key: "status", header: "Status", cell: (i) => <InvoiceStatusBadge status={i.status} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (i) => (
        <Menu
          label={`Actions for ${i.number}`}
          items={[
            { label: "View invoice", onSelect: () => navigate(`/invoices/${i.id}`) },
            ...(i.kind === "SALE" ? [{ label: "Print", onSelect: () => openInvoicePrint(i.id) }] : []),
            { label: "Send on WhatsApp (Phase 7)", disabled: true, onSelect: () => {} },
            ...(can("invoice.cancel") && i.status !== "CANCELLED"
              ? [
                  {
                    label: i.kind === "OPENING_BALANCE" ? "Cancel old dues" : "Cancel invoice",
                    destructive: true,
                    onSelect: () => setCancelling(i),
                  },
                ]
              : []),
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Invoices"
        description="GST invoices, payments, cancellations and credit notes."
        actions={
          can("pos.use") && (
            <Button icon={<Monitor className="size-4" />} onClick={() => navigate("/pos")}>
              New bill
            </Button>
          )
        }
      />
      <InvoicesTabs />

      <Card>
        <div className="space-y-3 border-b border-border p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-60 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate" />
              <Input
                aria-label="Search invoices"
                placeholder="Search invoice no., customer or mobile"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              aria-label="Payment method"
              className="w-44"
              value={paymentMode ?? ""}
              onChange={(e) => setParam({ paymentMode: e.target.value || undefined })}
            >
              <option value="">Any payment</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </Select>
            {multiBranch && (
              <Select
                aria-label="Branches"
                className="w-44"
                value={allBranches ? "all" : ""}
                onChange={(e) => setParam({ branchId: e.target.value || undefined })}
              >
                <option value="">This branch</option>
                <option value="all">All branches</option>
              </Select>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl<Range>
              label="Date range"
              value={range}
              onChange={setRange}
              options={[
                { value: "all", label: "All" },
                { value: "today", label: "Today" },
                { value: "7d", label: "7 days" },
                { value: "30d", label: "30 days" },
              ]}
            />
            <div className="flex items-center gap-2">
              <Input
                type="date"
                aria-label="From date"
                className="w-40"
                value={from ?? ""}
                max={to}
                onChange={(e) => setParam({ from: e.target.value || undefined })}
              />
              <span className="text-helper text-slate">to</span>
              <Input
                type="date"
                aria-label="To date"
                className="w-40"
                value={to ?? ""}
                min={from}
                onChange={(e) => setParam({ to: e.target.value || undefined })}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip selected={!status} onClick={() => setParam({ status: undefined })}>
              All
            </Chip>
            {INVOICE_STATUSES.map((s) => (
              <Chip key={s} selected={status === s} onClick={() => setParam({ status: s })}>
                {INVOICE_STATUS_LABELS[s]}
              </Chip>
            ))}
          </div>
        </div>

        {rows && rows.length > 0 && (
          <div className="flex flex-wrap gap-x-8 gap-y-1 border-b border-border px-6 py-3 text-helper text-slate">
            <span>
              <span className="font-semibold text-ink tabular">{query.data?.meta.total}</span> invoices
            </span>
            <span>
              This page: <span className="font-semibold text-ink tabular">{formatINR(pageTotal, { exact: true })}</span>
            </span>
            {pageDue > 0 && (
              <span>
                Outstanding on this page:{" "}
                <span className="font-semibold text-ink tabular">{formatINR(pageDue, { exact: true })}</span>
              </span>
            )}
          </div>
        )}

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(i) => i.id}
          loading={query.isPending}
          error={query.error}
          onRetry={() => query.refetch()}
          onRowClick={(i) => navigate(`/invoices/${i.id}`)}
          empty={
            filtered ? (
              <NoResults
                query={debounced || undefined}
                hint="Try the invoice number or mobile, or clear the filters."
                onClear={() => {
                  setSearch("");
                  setParams({});
                }}
              />
            ) : (
              <EmptyState
                icon={FileText}
                title="No invoices yet"
                description="Invoices appear here as soon as the counter charges its first bill."
                action={can("pos.use") && <Button onClick={() => navigate("/pos")}>Open POS</Button>}
              />
            )
          }
        />
        <Pagination meta={query.data?.meta} onPage={(p) => setParam({ page: String(p) })} />
      </Card>

      <CancelInvoiceDialog
        invoice={cancelling && { ...cancelling, oldDues: cancelling.kind === "OPENING_BALANCE" }}
        onClose={() => setCancelling(null)}
      />
    </>
  );
}
