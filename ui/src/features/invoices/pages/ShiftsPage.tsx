import { useNavigate, useSearchParams } from "react-router";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Chip, PageHeader } from "@/components/ui/Controls";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { EmptyState, NoResults } from "@/components/ui/States";
import type { Shift } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { useShifts } from "../api";
import { InvoicesTabs } from "../components/common";

const STATUSES = [
  { value: undefined, label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "CLOSED", label: "Closed" },
] as const;

// Counter shifts in the current branch. Cashiers see their own; managers (report.view) see everyone's.
export function ShiftsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page") ?? 1);
  const status = (params.get("status") as "OPEN" | "CLOSED" | null) ?? undefined;
  const query = useShifts({ page, status });

  const columns: Column<Shift>[] = [
    { key: "counter", header: "Counter", cell: (s) => <span className="font-medium text-navy-700">{s.counter}</span> },
    { key: "cashier", header: "Cashier", cell: (s) => s.user?.name ?? "—" },
    {
      key: "opened",
      header: "Opened",
      cell: (s) => <span className="whitespace-nowrap">{formatDateTime(s.openedAt)}</span>,
    },
    {
      key: "closed",
      header: "Closed",
      cell: (s) => <span className="whitespace-nowrap text-slate">{formatDateTime(s.closedAt)}</span>,
    },
    {
      key: "status",
      header: "Status",
      align: "right",
      cell: (s) => (s.status === "OPEN" ? <Badge tone="info">Open</Badge> : <Badge>Closed</Badge>),
    },
  ];

  return (
    <>
      <PageHeader title="Invoices" description="Invoices, credit notes and counter shifts for this branch." />
      <InvoicesTabs />
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-border p-4">
          {STATUSES.map((s) => (
            <Chip
              key={s.label}
              selected={status === s.value}
              onClick={() =>
                setParams((p) => {
                  if (s.value) p.set("status", s.value);
                  else p.delete("status");
                  p.delete("page");
                  return p;
                })
              }
            >
              {s.label}
            </Chip>
          ))}
        </div>
        <DataTable
          columns={columns}
          rows={query.data?.data}
          rowKey={(s) => s.id}
          loading={query.isPending}
          error={query.error}
          onRetry={() => query.refetch()}
          onRowClick={(s) => navigate(`/invoices/shifts/${s.id}`)}
          empty={
            status ? (
              <NoResults onClear={() => setParams({})} />
            ) : (
              <EmptyState
                icon={Clock}
                title="No shifts yet"
                description="A shift starts when a cashier opens the POS with their opening cash, and ends when they count the drawer."
              />
            )
          }
        />
        <Pagination
          meta={query.data?.meta}
          onPage={(p) =>
            setParams((prev) => {
              prev.set("page", String(p));
              return prev;
            })
          }
        />
      </Card>
    </>
  );
}
