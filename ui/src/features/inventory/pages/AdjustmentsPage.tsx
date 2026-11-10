import { useNavigate, useSearchParams } from "react-router";
import { ClipboardList, Plus } from "lucide-react";
import { formatINR, STOCK_ADJUSTMENT_REASON_LABELS, type StockAdjustmentStatus } from "@automobile/shared";
import { useAuth } from "@/app/auth";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip, PageHeader } from "@/components/ui/Controls";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { EmptyState, NoResults } from "@/components/ui/States";
import type { StockAdjustment } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { useAdjustments } from "../api";
import { adjustmentStatusBadge, InventoryTabs } from "../components/common";

const STATUS_FILTERS: { value: StockAdjustmentStatus | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "PENDING", label: "Awaiting approval" },
  { value: "POSTED", label: "Posted" },
  { value: "REJECTED", label: "Rejected" },
];

export function AdjustmentsPage() {
  const navigate = useNavigate();
  const { can, branch } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page") ?? 1);
  const status = (params.get("status") as StockAdjustmentStatus | null) ?? undefined;
  const query = useAdjustments({ page, status });

  const setParam = (key: string, value: string | undefined) =>
    setParams((p) => {
      if (value) p.set(key, value);
      else p.delete(key);
      if (key !== "page") p.delete("page");
      return p;
    });

  const columns: Column<StockAdjustment>[] = [
    {
      key: "number",
      header: "Number",
      cell: (a) => <span className="font-mono text-helper font-medium text-navy-700">{a.number}</span>,
    },
    {
      key: "date",
      header: "Date",
      cell: (a) => <span className="whitespace-nowrap text-slate">{formatDateTime(a.createdAt)}</span>,
    },
    {
      key: "reason",
      header: "Reason",
      cell: (a) => (
        <div className="min-w-0">
          <p className="text-ink">{STOCK_ADJUSTMENT_REASON_LABELS[a.reason]}</p>
          {a.note && <p className="max-w-64 truncate text-helper text-slate">{a.note}</p>}
        </div>
      ),
    },
    { key: "lines", header: "Lines", align: "right", cell: (a) => a.lineCount },
    { key: "value", header: "Value", align: "right", cell: (a) => formatINR(a.totalValue, { exact: true }) },
    {
      key: "status",
      header: "Status",
      cell: (a) => <Badge tone={adjustmentStatusBadge[a.status].tone}>{adjustmentStatusBadge[a.status].label}</Badge>,
    },
    { key: "by", header: "Created by", cell: (a) => <span className="text-slate">{a.createdBy?.name ?? "—"}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Inventory"
        description={branch ? `Parts, stock and labour for ${branch.name}.` : "Parts, stock and labour services."}
        actions={
          can("inventory.manage") && (
            <Button icon={<Plus className="size-4" />} onClick={() => navigate("/inventory/adjustments/new")}>
              New adjustment
            </Button>
          )
        }
      />
      <InventoryTabs />
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-border p-4">
          {STATUS_FILTERS.map((f) => (
            <Chip key={f.label} selected={status === f.value} onClick={() => setParam("status", f.value)}>
              {f.label}
            </Chip>
          ))}
        </div>
        <DataTable
          columns={columns}
          rows={query.data?.data}
          rowKey={(a) => a.id}
          loading={query.isPending}
          error={query.error}
          onRetry={() => query.refetch()}
          onRowClick={(a) => navigate(`/inventory/adjustments/${a.id}`)}
          empty={
            status ? (
              <NoResults hint="No adjustments have this status." onClear={() => setParams({})} />
            ) : (
              <EmptyState
                icon={ClipboardList}
                title="No stock adjustments yet"
                description="Record damaged, expired or miscounted parts here. Every change is kept in the stock ledger."
                action={
                  can("inventory.manage") && (
                    <Button onClick={() => navigate("/inventory/adjustments/new")}>New adjustment</Button>
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
