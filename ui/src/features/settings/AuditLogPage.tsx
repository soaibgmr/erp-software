import { useState } from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, NoResults } from "@/components/ui/States";
import type { AuditLog } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { useAuditLogs } from "./api";

const ACTION_FILTERS = [
  { value: "", label: "All activity" },
  { value: "auth.", label: "Sign-ins" },
  { value: "user.", label: "Users" },
  { value: "role.", label: "Roles" },
  { value: "branch.", label: "Branches" },
  { value: "business.", label: "Business profile" },
  { value: "settings.", label: "Settings" },
  { value: "sequence.", label: "Number series" },
  { value: "customer.", label: "Customers" },
];

const describe = (a: AuditLog) => a.action.replace(/\./g, " · ").replace(/^\w/, (c) => c.toUpperCase());

export function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [open, setOpen] = useState<AuditLog | null>(null);
  const query = useAuditLogs({ page, action: action || undefined });

  const columns: Column<AuditLog>[] = [
    {
      key: "when",
      header: "When",
      cell: (a) => <span className="whitespace-nowrap text-slate">{formatDateTime(a.createdAt)}</span>,
    },
    {
      key: "who",
      header: "Who",
      cell: (a) => (a.actor ? `${a.actor.firstName} ${a.actor.lastName}` : <span className="text-muted">System</span>),
    },
    { key: "what", header: "Action", cell: (a) => <span className="font-medium text-ink">{describe(a)}</span> },
    { key: "entity", header: "Record", cell: (a) => <span className="text-slate">{a.entity}</span> },
    {
      key: "details",
      header: "",
      align: "right",
      cell: (a) =>
        a.before || a.after ? (
          <Button size="sm" variant="ghost" onClick={() => setOpen(a)}>
            Changes
          </Button>
        ) : null,
    },
  ];

  return (
    <Card>
      <CardHeader
        title="Audit log"
        subtitle="Sensitive changes: who, what and when. Entries can't be edited or deleted."
        actions={
          <Select
            aria-label="Filter"
            className="h-8 w-48 text-helper"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          >
            {ACTION_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        }
      />
      <DataTable
        columns={columns}
        rows={query.data?.data}
        rowKey={(a) => a.id}
        loading={query.isPending}
        error={query.error}
        onRetry={() => query.refetch()}
        empty={
          action ? (
            <NoResults onClear={() => setAction("")} />
          ) : (
            <EmptyState icon={History} title="Nothing recorded yet" />
          )
        }
      />
      <Pagination meta={query.data?.meta} onPage={setPage} />

      <Modal open={Boolean(open)} onClose={() => setOpen(null)} size="lg" title={open ? describe(open) : ""}>
        {open && <ChangeTable before={open.before} after={open.after} />}
      </Modal>
    </Card>
  );
}

// Field-by-field before/after, changed fields only when both sides exist.
function ChangeTable({ before, after }: { before: unknown; after: unknown }) {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter(
    (k) =>
      !["id", "createdAt", "updatedAt"].includes(k) &&
      (!before || !after || JSON.stringify(b[k]) !== JSON.stringify(a[k])),
  );
  const show = (v: unknown) =>
    v === undefined || v === null || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);

  if (!keys.length) return <p className="text-body text-slate">No field changes.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-body">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="eyebrow py-2 pr-4 text-slate">Field</th>
            {before !== null && before !== undefined && <th className="eyebrow py-2 pr-4 text-slate">Before</th>}
            {after !== null && after !== undefined && <th className="eyebrow py-2 text-slate">After</th>}
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k} className="border-b border-border align-top last:border-0">
              <td className="py-2 pr-4 font-medium text-ink">{k}</td>
              {before !== null && before !== undefined && (
                <td className="py-2 pr-4 break-all text-slate">{show(b[k])}</td>
              )}
              {after !== null && after !== undefined && <td className="py-2 break-all text-ink">{show(a[k])}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
