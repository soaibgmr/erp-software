import { useNavigate, useSearchParams } from "react-router";
import { ArrowRight, Plus, Truck } from "lucide-react";
import { formatQty, type StockTransferStatus } from "@erp-software/shared";
import { useAuth } from "@/app/auth";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip, PageHeader, SegmentedControl } from "@/components/ui/Controls";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { EmptyState, NoResults } from "@/components/ui/States";
import { useBranches } from "@/features/settings/api";
import type { StockTransfer } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";
import { useTransfers } from "../api";
import { InventoryTabs, transferStatusBadge } from "../components/common";

type Direction = "all" | "in" | "out";

const STATUS_FILTERS: { value: StockTransferStatus | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "IN_TRANSIT", label: "In transit" },
  { value: "RECEIVED", label: "Received" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function TransfersPage() {
  const navigate = useNavigate();
  const { can, branch, me } = useAuth();
  const branches = useBranches(false);
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page") ?? 1);
  const direction = (params.get("direction") as Direction | null) ?? "all";
  const status = (params.get("status") as StockTransferStatus | null) ?? undefined;
  const query = useTransfers({ page, direction, status });

  // Needs somewhere to send to; owners can send to any branch.
  const otherBranches = (branches.data ?? []).filter((b) => b.isActive && b.id !== branch?.id).length;
  const canCreate = can("inventory.manage") && (me?.isOwner || otherBranches > 0 || branches.isError);

  const setParam = (key: string, value: string | undefined) =>
    setParams((p) => {
      if (value) p.set(key, value);
      else p.delete(key);
      if (key !== "page") p.delete("page");
      return p;
    });

  const branchName = (b: StockTransfer["fromBranch"]) => (
    <span className={cn(b.id === branch?.id ? "font-semibold text-navy-900" : "text-slate")}>{b.name}</span>
  );

  const columns: Column<StockTransfer>[] = [
    {
      key: "number",
      header: "Number",
      cell: (t) => <span className="font-mono text-helper font-medium text-navy-700">{t.number}</span>,
    },
    {
      key: "date",
      header: "Date",
      cell: (t) => <span className="whitespace-nowrap text-slate">{formatDateTime(t.createdAt)}</span>,
    },
    {
      key: "route",
      header: "From → To",
      cell: (t) => (
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          {branchName(t.fromBranch)}
          <ArrowRight className="size-3.5 text-muted" aria-label="to" />
          {branchName(t.toBranch)}
        </span>
      ),
    },
    { key: "lines", header: "Lines", align: "right", cell: (t) => t.lineCount },
    { key: "qty", header: "Qty", align: "right", cell: (t) => formatQty(t.totalQuantity) },
    {
      key: "status",
      header: "Status",
      cell: (t) => (
        <div className="flex items-center gap-2">
          <Badge tone={transferStatusBadge[t.status].tone}>{transferStatusBadge[t.status].label}</Badge>
          {t.status === "IN_TRANSIT" && t.toBranch.id === branch?.id && (
            <span className="text-helper font-medium text-navy-700">Receive</span>
          )}
        </div>
      ),
    },
  ];

  const filtered = direction !== "all" || Boolean(status);

  return (
    <>
      <PageHeader
        title="Inventory"
        description={branch ? `Parts, stock and labour for ${branch.name}.` : "Parts, stock and labour services."}
        actions={
          canCreate && (
            <Button icon={<Plus className="size-4" />} onClick={() => navigate("/inventory/transfers/new")}>
              New transfer
            </Button>
          )
        }
      />
      <InventoryTabs />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <SegmentedControl<Direction>
            label="Direction"
            value={direction}
            onChange={(v) => setParam("direction", v === "all" ? undefined : v)}
            options={[
              { value: "all", label: "All" },
              { value: "in", label: "Incoming" },
              { value: "out", label: "Outgoing" },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => (
              <Chip key={f.label} selected={status === f.value} onClick={() => setParam("status", f.value)}>
                {f.label}
              </Chip>
            ))}
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={query.data?.data}
          rowKey={(t) => t.id}
          loading={query.isPending}
          error={query.error}
          onRetry={() => query.refetch()}
          onRowClick={(t) => navigate(`/inventory/transfers/${t.id}`)}
          empty={
            filtered ? (
              <NoResults hint="No transfers match these filters." onClear={() => setParams({})} />
            ) : (
              <EmptyState
                icon={Truck}
                title="No stock transfers yet"
                description="Send parts to another branch. Stock leaves here when dispatched and arrives when they receive it."
                action={canCreate && <Button onClick={() => navigate("/inventory/transfers/new")}>New transfer</Button>}
              />
            )
          }
        />
        <Pagination meta={query.data?.meta} onPage={(p) => setParam("page", String(p))} />
      </Card>
    </>
  );
}
