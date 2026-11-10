import { useState } from "react";
import { CalendarCheck } from "lucide-react";
import { formatMobile } from "@erp-software/shared";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/Controls";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { DemoRequest } from "@/lib/types";
import { errorMessage, formatDateTime } from "@/lib/utils";
import { useDemoRequests, usePlatformToken, useSetDemoRequestHandled } from "./api";

type Filter = "open" | "handled" | "all";

// "Book a quick demo" requests from the landing page. Call them back, then mark them handled.
export function PlatformDemoRequestsPage() {
  const { token } = usePlatformToken();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("open");
  const [page, setPage] = useState(1);
  const requests = useDemoRequests(token, { status: filter === "all" ? undefined : filter, page });
  const setHandled = useSetDemoRequestHandled(token);

  const toggle = (r: DemoRequest) =>
    setHandled.mutate(
      { id: r.id, handled: !r.handledAt },
      {
        onSuccess: () => toast({ message: r.handledAt ? "Moved back to open" : "Marked as handled" }),
        onError: (err) => toast({ message: errorMessage(err), tone: "error" }),
      },
    );

  const columns: Column<DemoRequest>[] = [
    {
      key: "who",
      header: "Name",
      cell: (r) => <span className={r.name ? "font-medium text-ink" : "text-slate"}>{r.name ?? "Not given"}</span>,
    },
    {
      key: "phone",
      header: "Phone",
      cell: (r) => (
        <a href={`tel:+91${r.mobile}`} className="font-medium text-navy-600 hover:underline">
          {formatMobile(r.mobile)}
        </a>
      ),
    },
    {
      key: "email",
      header: "Email",
      cell: (r) =>
        r.email ? (
          <a href={`mailto:${r.email}`} className="text-navy-600 hover:underline">
            {r.email}
          </a>
        ) : (
          <span className="text-slate">—</span>
        ),
    },
    { key: "when", header: "Requested", cell: (r) => formatDateTime(r.createdAt) },
    {
      key: "status",
      header: "Status",
      cell: (r) => (r.handledAt ? <Badge tone="success">Handled</Badge> : <Badge tone="warning">To call</Badge>),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (r) => (
        <Button size="sm" variant={r.handledAt ? "ghost" : "outline"} onClick={() => toggle(r)}>
          {r.handledAt ? "Reopen" : "Mark handled"}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-page font-bold text-ink">Demo requests</h1>
        <p className="text-body text-slate">People who booked a demo on the landing page. Call them back.</p>
      </div>
      <SegmentedControl<Filter>
        label="Status"
        value={filter}
        onChange={(v) => {
          setFilter(v);
          setPage(1);
        }}
        options={[
          { value: "open", label: "To call" },
          { value: "handled", label: "Handled" },
          { value: "all", label: "All" },
        ]}
      />
      <div className="overflow-hidden rounded-card border border-border bg-surface">
        <DataTable
          columns={columns}
          rows={requests.data?.data}
          rowKey={(r) => r.id}
          loading={requests.isPending}
          error={requests.error}
          onRetry={() => requests.refetch()}
          empty={
            <EmptyState
              icon={CalendarCheck}
              title={filter === "open" ? "No one waiting for a call" : "No demo requests yet"}
              description="Requests from the landing page's “Book a quick demo” form appear here."
            />
          }
        />
        <Pagination meta={requests.data?.meta} onPage={setPage} />
      </div>
    </div>
  );
}
