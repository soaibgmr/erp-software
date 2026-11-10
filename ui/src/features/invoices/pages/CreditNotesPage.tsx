import { Link, useNavigate, useSearchParams } from "react-router";
import { Monitor, Undo2 } from "lucide-react";
import { formatINR } from "@erp-software/shared";
import { useAuth } from "@/app/auth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Controls";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/States";
import type { CreditNote } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { useCreditNotes } from "../api";
import { InvoicesTabs } from "../components/common";

export function CreditNotesPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page") ?? 1);
  const query = useCreditNotes({ page });

  const columns: Column<CreditNote>[] = [
    {
      key: "number",
      header: "Credit note",
      cell: (c) => (
        <div>
          <Link
            to={`/invoices/credit-notes/${c.id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-mono font-semibold text-navy-700 hover:underline"
          >
            {c.number}
          </Link>
          <p className="max-w-72 truncate text-helper text-slate">{c.reason}</p>
        </div>
      ),
    },
    {
      key: "date",
      header: "Date",
      cell: (c) => <span className="whitespace-nowrap text-slate">{formatDate(c.createdAt)}</span>,
    },
    {
      key: "invoice",
      header: "Invoice",
      cell: (c) => (
        <Link
          to={`/invoices/${c.invoice.id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-navy-700 hover:underline"
        >
          {c.invoice.number}
        </Link>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      cell: (c) => c.invoice.customerName ?? <span className="text-muted">Walk-in</span>,
    },
    { key: "total", header: "Total", align: "right", cell: (c) => formatINR(c.total, { exact: true }) },
    {
      key: "refunded",
      header: "Refunded",
      align: "right",
      cell: (c) =>
        Number(c.refunded) > 0 ? formatINR(c.refunded, { exact: true }) : <span className="text-muted">—</span>,
    },
    { key: "by", header: "By", cell: (c) => <span className="text-slate">{c.createdBy?.name ?? "—"}</span> },
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
        <DataTable
          columns={columns}
          rows={query.data?.data}
          rowKey={(c) => c.id}
          loading={query.isPending}
          error={query.error}
          onRetry={() => query.refetch()}
          onRowClick={(c) => navigate(`/invoices/credit-notes/${c.id}`)}
          empty={
            <EmptyState
              icon={Undo2}
              title="No credit notes yet"
              description="When a customer returns parts, open the invoice and choose Credit note. Returns appear here."
            />
          }
        />
        <Pagination
          meta={query.data?.meta}
          onPage={(p) =>
            setParams((sp) => {
              sp.set("page", String(p));
              return sp;
            })
          }
        />
      </Card>
    </>
  );
}
