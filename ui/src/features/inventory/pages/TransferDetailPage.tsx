import { useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowRight, Info, PackageCheck } from "lucide-react";
import { formatINR, formatQty } from "@erp-software/shared";
import { useAuth } from "@/app/auth";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DescriptionList, PageHeader } from "@/components/ui/Controls";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/Modal";
import { ErrorBanner, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { DocLine } from "@/lib/types";
import { errorMessage, formatDateTime } from "@/lib/utils";
import { useTransfer, useTransferAction } from "../api";
import { qtyWithUnit, transferStatusBadge } from "../components/common";

export function TransferDetailPage() {
  const { id } = useParams();
  const { can, branch } = useAuth();
  const toast = useToast();
  const query = useTransfer(id);
  const action = useTransferAction(id ?? "");
  const [confirm, setConfirm] = useState<"receive" | "cancel" | null>(null);

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
        title="Couldn't load this transfer"
        message={errorMessage(query.error)}
        onRetry={() => query.refetch()}
      />
    );
  }
  const t = query.data;
  const badge = transferStatusBadge[t.status];
  const open = t.status === "IN_TRANSIT";
  const manage = can("inventory.manage");
  const atReceiver = branch?.id === t.toBranch.id;
  const atSender = branch?.id === t.fromBranch.id;

  const run = async (kind: "receive" | "cancel") => {
    try {
      const res = await action.mutateAsync(kind);
      toast({ message: kind === "receive" ? `${res.number} received` : `${res.number} cancelled` });
    } catch (err) {
      toast({ message: errorMessage(err), tone: "error" });
    }
    setConfirm(null);
  };

  const columns: Column<DocLine>[] = [
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
    { key: "qty", header: "Quantity", align: "right", cell: (l) => qtyWithUnit(l.quantity, l.unit) },
    { key: "cost", header: "Unit cost", align: "right", cell: (l) => formatINR(l.unitCost, { exact: true }) },
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
            <Link to="/inventory/transfers" className="hover:text-navy-700">
              Transfers
            </Link>{" "}
            / {t.number}
          </>
        }
        title={t.number}
        badge={<Badge tone={badge.tone}>{badge.label}</Badge>}
        description={
          <span className="inline-flex items-center gap-2">
            {t.fromBranch.name}
            <ArrowRight className="size-3.5" aria-label="to" />
            {t.toBranch.name}
          </span>
        }
        actions={
          open &&
          manage && (
            <>
              {atSender && (
                <Button variant="danger-outline" onClick={() => setConfirm("cancel")}>
                  Cancel transfer
                </Button>
              )}
              {atReceiver && (
                <Button icon={<PackageCheck className="size-4" />} onClick={() => setConfirm("receive")}>
                  Receive stock
                </Button>
              )}
            </>
          )
        }
      />

      {open && !atReceiver && (
        <div className="mb-6 flex gap-3 rounded-card border border-info-50 bg-info-50 p-4 text-helper text-info">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            In transit. Switch to {t.toBranch.name} to receive it
            {atSender ? `, or cancel it here to return the stock to ${t.fromBranch.name}` : ""}.
          </p>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader
            title="Lines"
            subtitle={`${t.lineCount} item${t.lineCount === 1 ? "" : "s"} · ${formatQty(t.totalQuantity)} units`}
          />
          <DataTable columns={columns} rows={t.lines} rowKey={(l) => l.itemId} />
        </Card>

        <Card>
          <CardHeader title="Details" />
          <CardBody>
            <DescriptionList
              items={[
                { label: "From", value: `${t.fromBranch.name} (${t.fromBranch.code})` },
                { label: "To", value: `${t.toBranch.name} (${t.toBranch.code})` },
                {
                  label: "Dispatched",
                  value: `${formatDateTime(t.createdAt)}${t.createdBy ? ` by ${t.createdBy.name}` : ""}`,
                },
                ...(t.closedAt
                  ? [
                      {
                        label: t.status === "RECEIVED" ? "Received" : "Cancelled",
                        value: `${formatDateTime(t.closedAt)}${t.closedBy ? ` by ${t.closedBy.name}` : ""}`,
                      },
                    ]
                  : []),
                { label: "Note", value: t.note },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={confirm === "receive"}
        destructive={false}
        title={`Receive ${t.number}?`}
        body={`${formatQty(t.totalQuantity)} units across ${t.lineCount} item${t.lineCount === 1 ? "" : "s"} are added to ${t.toBranch.name}'s stock. Check the parts against this list first.`}
        cancelLabel="Not yet"
        confirmLabel="Receive stock"
        loading={action.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => void run("receive")}
      />
      <ConfirmDialog
        open={confirm === "cancel"}
        title={`Cancel ${t.number}?`}
        body={`The stock returns to ${t.fromBranch.name} and ${t.toBranch.name} can no longer receive it. This can't be undone.`}
        cancelLabel="Keep transfer"
        confirmLabel="Cancel transfer"
        loading={action.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => void run("cancel")}
      />
    </>
  );
}
