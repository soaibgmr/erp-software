import { useState } from "react";
import { Link, useParams } from "react-router";
import { Check, X } from "lucide-react";
import { formatINR, STOCK_ADJUSTMENT_REASON_LABELS } from "@automobile/shared";
import { useAuth } from "@/app/auth";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DescriptionList, PageHeader } from "@/components/ui/Controls";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Field, Textarea } from "@/components/ui/Field";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { ErrorBanner, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { StockAdjustmentDetail } from "@/lib/types";
import { errorMessage, formatDateTime } from "@/lib/utils";
import { useAdjustment, useDecideAdjustment } from "../api";
import { adjustmentStatusBadge, SignedQty } from "../components/common";

type Line = StockAdjustmentDetail["lines"][number];

export function AdjustmentDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const query = useAdjustment(id);
  const decide = useDecideAdjustment(id ?? "");
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

  if (query.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }
  if (query.error || !query.data) {
    return (
      <ErrorBanner
        title="Couldn't load this adjustment"
        message={errorMessage(query.error)}
        onRetry={() => query.refetch()}
      />
    );
  }
  const a = query.data;
  const badge = adjustmentStatusBadge[a.status];

  const run = async (action: "approve" | "reject") => {
    try {
      const res = await decide.mutateAsync({ action, note: rejectNote.trim() });
      toast({ message: action === "approve" ? `${res.number} approved and posted` : `${res.number} rejected` });
    } catch (err) {
      toast({ message: errorMessage(err), tone: "error" });
    }
    setApproving(false);
    setRejecting(false);
  };

  const columns: Column<Line>[] = [
    {
      key: "item",
      header: "Item",
      cell: (l) => (
        <Link to={`/inventory/items/${l.itemId}`} className="font-medium text-navy-700 hover:underline">
          {l.name}
        </Link>
      ),
    },
    { key: "sku", header: "SKU", cell: (l) => <span className="font-mono text-helper">{l.sku}</span> },
    { key: "qty", header: "Change", align: "right", cell: (l) => <SignedQty value={l.quantity} /> },
    { key: "cost", header: "Unit cost", align: "right", cell: (l) => formatINR(l.unitCost, { exact: true }) },
    { key: "value", header: "Value", align: "right", cell: (l) => formatINR(l.value, { exact: true }) },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <Link to="/inventory" className="hover:text-navy-700">
              Inventory
            </Link>{" "}
            /{" "}
            <Link to="/inventory/adjustments" className="hover:text-navy-700">
              Adjustments
            </Link>{" "}
            / {a.number}
          </>
        }
        title={a.number}
        badge={<Badge tone={badge.tone}>{badge.label}</Badge>}
        description={[STOCK_ADJUSTMENT_REASON_LABELS[a.reason], formatDateTime(a.createdAt), a.createdBy?.name]
          .filter(Boolean)
          .join(" · ")}
        actions={
          a.status === "PENDING" &&
          can("stock.approve") && (
            <>
              <Button variant="danger-outline" icon={<X className="size-4" />} onClick={() => setRejecting(true)}>
                Reject
              </Button>
              <Button icon={<Check className="size-4" />} onClick={() => setApproving(true)}>
                Approve and post
              </Button>
            </>
          )
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader
            title="Lines"
            subtitle={`${a.lineCount} item${a.lineCount === 1 ? "" : "s"}, valued at purchase price`}
          />
          <DataTable columns={columns} rows={a.lines} rowKey={(l) => l.itemId} />
          <div className="flex justify-end gap-6 border-t border-border px-6 py-4 text-body">
            <span className="text-slate">Total value</span>
            <span className="font-semibold text-ink tabular">{formatINR(a.totalValue, { exact: true })}</span>
          </div>
        </Card>

        <Card>
          <CardHeader title="Details" />
          <CardBody>
            <DescriptionList
              items={[
                { label: "Reason", value: STOCK_ADJUSTMENT_REASON_LABELS[a.reason] },
                { label: "Note", value: a.note },
                {
                  label: "Created",
                  value: `${formatDateTime(a.createdAt)}${a.createdBy ? ` by ${a.createdBy.name}` : ""}`,
                },
                ...(a.status === "PENDING"
                  ? [{ label: "Status", value: "Waiting for a manager. Stock hasn't changed yet." }]
                  : [
                      {
                        label: a.status === "POSTED" ? "Posted" : "Rejected",
                        value: a.decidedAt
                          ? `${formatDateTime(a.decidedAt)}${a.decidedBy ? ` by ${a.decidedBy.name}` : ""}`
                          : formatDateTime(a.createdAt),
                      },
                      ...(a.decisionNote ? [{ label: "Decision note", value: a.decisionNote }] : []),
                    ]),
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={approving}
        destructive={false}
        title={`Post ${a.number}?`}
        body={`Stock changes for ${a.lineCount} item${a.lineCount === 1 ? "" : "s"} (${formatINR(a.totalValue, { exact: true })}) and the change is written to the stock ledger. This can't be undone; a correction needs a new adjustment.`}
        cancelLabel="Not now"
        confirmLabel="Approve and post"
        loading={decide.isPending}
        onClose={() => setApproving(false)}
        onConfirm={() => void run("approve")}
      />

      <Modal
        open={rejecting}
        onClose={() => setRejecting(false)}
        title={`Reject ${a.number}?`}
        footer={
          <>
            <Button variant="outline" onClick={() => setRejecting(false)}>
              Keep pending
            </Button>
            <Button variant="danger" loading={decide.isPending} onClick={() => void run("reject")}>
              Reject adjustment
            </Button>
          </>
        }
      >
        <p className="mb-4 text-body text-slate">Stock won't change. The requester sees your note.</p>
        <Field label="Note">
          {(p) => (
            <Textarea
              {...p}
              rows={3}
              maxLength={300}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
          )}
        </Field>
      </Modal>
    </>
  );
}
