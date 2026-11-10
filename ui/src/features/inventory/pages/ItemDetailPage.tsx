import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useParams } from "react-router";
import { History, Pencil, Printer, SlidersHorizontal } from "lucide-react";
import type { z } from "zod";
import { formatINR, formatQty, ITEM_UNIT_LABELS, STOCK_MOVEMENT_LABELS, stockSettingsSchema } from "@automobile/shared";
import { useAuth } from "@/app/auth";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DescriptionList, PageHeader } from "@/components/ui/Controls";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Field, Input } from "@/components/ui/Field";
import { Menu } from "@/components/ui/Menu";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorBanner, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { ItemDetail, ItemStock, LedgerEntry } from "@/lib/types";
import { applyServerErrors, errorMessage, formatDateTime } from "@/lib/utils";
import { useDeleteItem, useItem, useLedger, useUpdateStockSettings } from "../api";
import { qtyWithUnit, SignedQty, StockBadge } from "../components/common";

const refLink = (e: LedgerEntry) => {
  if (!e.refNo) return <span className="text-muted">—</span>;
  const to =
    e.refType === "StockAdjustment" && e.refId
      ? `/inventory/adjustments/${e.refId}`
      : e.refType === "StockTransfer" && e.refId
        ? `/inventory/transfers/${e.refId}`
        : null;
  return to ? (
    <Link
      to={to}
      className="font-mono text-helper text-navy-700 hover:underline"
      onClick={(ev) => ev.stopPropagation()}
    >
      {e.refNo}
    </Link>
  ) : (
    <span className="font-mono text-helper">{e.refNo}</span>
  );
};

export function ItemDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { can, branch } = useAuth();
  const query = useItem(id);
  const remove = useDeleteItem();
  const [confirming, setConfirming] = useState(false);
  const [editingLevels, setEditingLevels] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(1);
  const ledger = useLedger(id, ledgerPage);

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
        title="Couldn't load this item"
        message={errorMessage(query.error)}
        onRetry={() => query.refetch()}
      />
    );
  }
  const item = query.data;
  const manage = can("inventory.manage");
  const stock = item.stock;

  const onDelete = async () => {
    try {
      await remove.mutateAsync(item.id);
      toast({ message: `${item.name} deleted` });
      navigate("/inventory");
    } catch (err) {
      toast({ message: errorMessage(err), tone: "error" });
      setConfirming(false);
    }
  };

  const ledgerColumns: Column<LedgerEntry>[] = [
    {
      key: "date",
      header: "Date",
      cell: (e) => <span className="whitespace-nowrap text-slate">{formatDateTime(e.createdAt)}</span>,
    },
    {
      key: "type",
      header: "Movement",
      cell: (e) => <span className="whitespace-nowrap">{STOCK_MOVEMENT_LABELS[e.type]}</span>,
    },
    { key: "ref", header: "Reference", cell: refLink },
    { key: "note", header: "Note", cell: (e) => <span className="text-helper text-slate">{e.note ?? "—"}</span> },
    { key: "qty", header: "Qty", align: "right", cell: (e) => <SignedQty value={e.quantity} /> },
    { key: "balance", header: "Balance", align: "right", cell: (e) => formatQty(e.balanceAfter) },
    {
      key: "by",
      header: "By",
      cell: (e) => <span className="whitespace-nowrap text-helper text-slate">{e.createdBy?.name ?? "—"}</span>,
    },
  ];

  const labelQty = Math.max(1, Math.min(Math.round(Number(stock?.onHand ?? 1)), 100));

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <Link to="/inventory" className="hover:text-navy-700">
              Inventory
            </Link>{" "}
            / {item.name}
          </>
        }
        title={item.name}
        badge={
          <>
            <Badge tone="navy" dot={false} className="font-mono">
              {item.sku}
            </Badge>
            {item.isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}
          </>
        }
        description={
          [item.brand?.name, item.category?.name, item.oemPartNo && `OEM ${item.oemPartNo}`]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        actions={
          <>
            <Button
              variant="outline"
              icon={<Printer className="size-4" />}
              onClick={() => navigate(`/print/labels?items=${item.id}:${labelQty}`)}
            >
              Print labels
            </Button>
            {manage && (
              <>
                <Button
                  variant="outline"
                  icon={<SlidersHorizontal className="size-4" />}
                  onClick={() => navigate(`/inventory/adjustments/new?itemId=${item.id}`)}
                >
                  Adjust stock
                </Button>
                <Button
                  variant="outline"
                  icon={<Pencil className="size-4" />}
                  onClick={() => navigate(`/inventory/items/${item.id}/edit`)}
                >
                  Edit
                </Button>
                <Menu items={[{ label: "Delete item", destructive: true, onSelect: () => setConfirming(true) }]} />
              </>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <CardBody>
              <DescriptionList
                items={[
                  { label: "Brand", value: item.brand?.name },
                  { label: "Category", value: item.category?.name },
                  {
                    label: "OEM part number",
                    value: item.oemPartNo && <span className="font-mono">{item.oemPartNo}</span>,
                  },
                  { label: "Unit", value: `${ITEM_UNIT_LABELS[item.unit]} (${item.unit})` },
                  { label: "HSN code", value: item.hsnCode && <span className="font-mono">{item.hsnCode}</span> },
                  { label: "GST", value: `${item.gstRate}%${item.taxInclusive ? " · included in price" : ""}` },
                  {
                    label: "Sale price",
                    value: <span className="tabular">{formatINR(item.salePrice, { exact: true })}</span>,
                  },
                  {
                    label: "MRP",
                    value: item.mrp && <span className="tabular">{formatINR(item.mrp, { exact: true })}</span>,
                  },
                  {
                    label: "Purchase price",
                    value: <span className="tabular">{formatINR(item.purchasePrice, { exact: true })}</span>,
                  },
                  {
                    label: "Barcodes",
                    value: item.barcodes.length ? (
                      <span className="font-mono">{item.barcodes.join(", ")}</span>
                    ) : (
                      <span className="text-muted">None · labels use the SKU</span>
                    ),
                  },
                  {
                    label: "Fits vehicles",
                    value: item.compatibleModels.length
                      ? item.compatibleModels.map((m) => `${m.makeName} ${m.name}`).join(", ")
                      : null,
                  },
                  { label: "Description", value: item.description },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Stock ledger"
              subtitle={`Every movement in ${branch?.name ?? "this branch"}, newest first.`}
            />
            <DataTable
              columns={ledgerColumns}
              rows={ledger.data?.data}
              rowKey={(e) => e.id}
              loading={ledger.isPending}
              error={ledger.error}
              onRetry={() => ledger.refetch()}
              empty={
                <EmptyState
                  icon={History}
                  title="No movements yet"
                  description="Opening stock, adjustments, transfers and sales of this item in this branch appear here."
                />
              }
            />
            <Pagination meta={ledger.data?.meta} onPage={setLedgerPage} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title={`Stock in ${branch?.name ?? "this branch"}`}
              actions={stock && <StockBadge status={stock.status} />}
            />
            <CardBody>
              {stock ? (
                <>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <Stat label="On hand" value={qtyWithUnit(stock.onHand, item.unit)} />
                    <Stat label="Available" value={qtyWithUnit(stock.available, item.unit)} strong />
                    <Stat label="Reserved" value={formatQty(stock.reserved)} />
                    <Stat label="In transit" value={formatQty(stock.inTransit)} />
                    <Stat label="Min level" value={Number(stock.minLevel) ? formatQty(stock.minLevel) : "—"} />
                    <Stat label="Reorder qty" value={Number(stock.reorderQty) ? formatQty(stock.reorderQty) : "—"} />
                    <Stat label="Bin" value={stock.binLocation ?? "—"} />
                  </dl>
                  {manage && (
                    <Button variant="outline" size="sm" className="mt-5" onClick={() => setEditingLevels(true)}>
                      Edit levels
                    </Button>
                  )}
                </>
              ) : (
                <p className="text-body text-slate">Choose a branch to see its stock.</p>
              )}
            </CardBody>
          </Card>

          {item.stockByBranch.length > 1 && (
            <Card>
              <CardHeader title="All branches" />
              <ul>
                {item.stockByBranch.map((b) => (
                  <li
                    key={b.branchId}
                    className="flex items-center gap-3 border-b border-border px-6 py-3 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-medium text-ink">{b.branchName}</p>
                      {Number(b.inTransit) > 0 && (
                        <p className="text-helper text-slate">{formatQty(b.inTransit)} in transit</p>
                      )}
                    </div>
                    <span className="text-body text-ink tabular">{formatQty(b.available)}</span>
                    <StockBadge status={b.status} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {stock && (
        <StockLevelsModal open={editingLevels} item={item} stock={stock} onClose={() => setEditingLevels(false)} />
      )}

      <ConfirmDialog
        open={confirming}
        title={`Delete ${item.name}?`}
        body="It disappears from search and the POS. Its stock history stays in reports. Items with stock left in any branch can't be deleted."
        cancelLabel="Keep item"
        confirmLabel="Delete item"
        loading={remove.isPending}
        onClose={() => setConfirming(false)}
        onConfirm={onDelete}
      />
    </>
  );
}

function Stat({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-helper text-slate">{label}</dt>
      <dd
        className={strong ? "mt-0.5 text-section font-semibold text-ink tabular" : "mt-0.5 text-body text-ink tabular"}
      >
        {value}
      </dd>
    </div>
  );
}

type LevelsInput = z.input<typeof stockSettingsSchema>;

function StockLevelsModal({
  open,
  item,
  stock,
  onClose,
}: {
  open: boolean;
  item: ItemDetail;
  stock: ItemStock;
  onClose: () => void;
}) {
  const save = useUpdateStockSettings(item.id);
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<LevelsInput, unknown, z.output<typeof stockSettingsSchema>>({
    resolver: zodResolver(stockSettingsSchema),
  });

  useEffect(() => {
    if (open)
      reset({
        minLevel: formatQty(stock.minLevel).replace(/,/g, ""),
        reorderQty: formatQty(stock.reorderQty).replace(/,/g, ""),
        binLocation: stock.binLocation ?? "",
      });
  }, [open, stock, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values);
      toast({ message: "Stock levels saved" });
      onClose();
    } catch (err) {
      const message = applyServerErrors(err, setError);
      if (message) toast({ message, tone: "error" });
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Stock levels"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} loadingText="Saving…" onClick={onSubmit}>
            Save levels
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <p className="text-body text-slate">
          {item.name} in this branch. Items at or below the minimum show as low stock.
        </p>
        <Field label="Minimum level" error={errors.minLevel?.message}>
          {(p) => (
            <Input {...p} type="number" min={0} step="any" align="right" suffix={item.unit} {...register("minLevel")} />
          )}
        </Field>
        <Field
          label="Reorder quantity"
          error={errors.reorderQty?.message}
          helper="How many to buy when the item runs low."
        >
          {(p) => (
            <Input
              {...p}
              type="number"
              min={0}
              step="any"
              align="right"
              suffix={item.unit}
              {...register("reorderQty")}
            />
          )}
        </Field>
        <Field label="Bin location" error={errors.binLocation?.message} helper="Shelf or rack, e.g. A-12.">
          {(p) => <Input {...p} className="font-mono uppercase" maxLength={30} {...register("binLocation")} />}
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
