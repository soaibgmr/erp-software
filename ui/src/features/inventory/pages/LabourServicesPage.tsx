import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Search, Wrench } from "lucide-react";
import type { z } from "zod";
import { formatINR, formatQty, GST_RATES, labourServiceCreateSchema } from "@erp-software/shared";
import { useAuth } from "@/app/auth";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Controls";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Checkbox, Field, FormGrid, Input, Select } from "@/components/ui/Field";
import { Menu } from "@/components/ui/Menu";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { EmptyState, NoResults } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useSettings } from "@/features/settings/api";
import { useDebounced } from "@/lib/hooks";
import type { LabourService } from "@/lib/types";
import { applyServerErrors, errorMessage } from "@/lib/utils";
import { useDeleteLabourService, useLabourServices, useSaveLabourService } from "../api";
import { InventoryTabs } from "../components/common";

type FormInput = z.input<typeof labourServiceCreateSchema>;

export function LabourServicesPage() {
  const { can, branch } = useAuth();
  const toast = useToast();
  const manage = can("inventory.manage");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const debounced = useDebounced(search.trim());
  const query = useLabourServices({ page, search: debounced || undefined, isActive: showInactive ? undefined : true });
  const save = useSaveLabourService();
  const remove = useDeleteLabourService();
  const [editing, setEditing] = useState<LabourService | "new" | null>(null);
  const [deleting, setDeleting] = useState<LabourService | null>(null);

  const toggleActive = async (s: LabourService) => {
    try {
      await save.mutateAsync({ id: s.id, body: { isActive: !s.isActive } });
      toast({ message: `${s.name} ${s.isActive ? "deactivated" : "activated"}` });
    } catch (err) {
      toast({ message: errorMessage(err), tone: "error" });
    }
  };

  const columns: Column<LabourService>[] = [
    {
      key: "name",
      header: "Service",
      cell: (s) => (
        <div className="min-w-0">
          <p className="font-medium text-ink">{s.name}</p>
          {s.code && <p className="font-mono text-helper text-slate">{s.code}</p>}
        </div>
      ),
    },
    { key: "sac", header: "SAC", cell: (s) => <span className="font-mono text-helper">{s.sacCode}</span> },
    { key: "gst", header: "GST", align: "right", cell: (s) => `${s.gstRate}%` },
    { key: "rate", header: "Rate", align: "right", cell: (s) => formatINR(s.rate, { exact: true }) },
    {
      key: "hours",
      header: "Std hours",
      align: "right",
      cell: (s) => (Number(s.standardHours) ? formatQty(s.standardHours) : "—"),
    },
    {
      key: "status",
      header: "Status",
      cell: (s) => (s.isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>),
    },
    ...(manage
      ? [
          {
            key: "actions",
            header: "",
            align: "right" as const,
            cell: (s: LabourService) => (
              <Menu
                items={[
                  { label: "Edit", onSelect: () => setEditing(s) },
                  { label: s.isActive ? "Deactivate" : "Activate", onSelect: () => void toggleActive(s) },
                  { label: "Delete service", destructive: true, onSelect: () => setDeleting(s) },
                ]}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Inventory"
        description={branch ? `Parts, stock and labour for ${branch.name}.` : "Parts, stock and labour services."}
        actions={
          manage && (
            <Button icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
              New labour service
            </Button>
          )
        }
      />
      <InventoryTabs />
      <Card>
        <div className="flex flex-wrap items-center gap-4 border-b border-border p-4">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate" />
            <Input
              aria-label="Search labour services"
              placeholder="Search name, code or SAC"
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Checkbox
            label="Show inactive"
            checked={showInactive}
            onChange={(e) => {
              setShowInactive(e.target.checked);
              setPage(1);
            }}
          />
        </div>
        <DataTable
          columns={columns}
          rows={query.data?.data}
          rowKey={(s) => s.id}
          loading={query.isPending}
          error={query.error}
          onRetry={() => query.refetch()}
          onRowClick={manage ? (s) => setEditing(s) : undefined}
          empty={
            debounced ? (
              <NoResults
                query={debounced}
                onClear={() => {
                  setSearch("");
                  setPage(1);
                }}
              />
            ) : (
              <EmptyState
                icon={Wrench}
                title="No labour services yet"
                description="Add the work you charge for, like periodic service or wheel alignment. They can be added to bills at the POS."
                action={manage && <Button onClick={() => setEditing("new")}>New labour service</Button>}
              />
            )
          }
        />
        <Pagination meta={query.data?.meta} onPage={setPage} />
      </Card>

      <LabourForm
        service={editing}
        saving={save.isPending}
        onClose={() => setEditing(null)}
        onSave={async (values, setError) => {
          try {
            const s = await save.mutateAsync({ id: editing === "new" ? undefined : editing?.id, body: values });
            toast({ message: editing === "new" ? `${s.name} added` : `${s.name} saved` });
            setEditing(null);
          } catch (err) {
            const message = applyServerErrors(err, setError);
            if (message) toast({ message, tone: "error" });
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name}?`}
        body="It disappears from billing. Past invoices keep their lines. To keep it but hide it, deactivate it instead."
        cancelLabel="Keep service"
        confirmLabel="Delete service"
        loading={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(deleting!.id);
            toast({ message: `${deleting!.name} deleted` });
          } catch (err) {
            toast({ message: errorMessage(err), tone: "error" });
          }
          setDeleting(null);
        }}
      />
    </>
  );
}

function LabourForm({
  service,
  saving,
  onClose,
  onSave,
}: {
  service: LabourService | "new" | null;
  saving: boolean;
  onClose: () => void;
  onSave: (values: unknown, setError: ReturnType<typeof useForm<FormInput>>["setError"]) => Promise<void>;
}) {
  const settings = useSettings();
  const defaultSac = settings.data?.tax.defaultLabourSac ?? "998714";
  const defaultGst = settings.data?.tax.defaultGstRate ?? 18;
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormInput>({ resolver: zodResolver(labourServiceCreateSchema) });

  useEffect(() => {
    if (service === "new") {
      reset({
        code: "",
        name: "",
        sacCode: defaultSac,
        gstRate: String(defaultGst),
        rate: "",
        standardHours: "0",
        isActive: true,
      });
    } else if (service) {
      reset({
        code: service.code ?? "",
        name: service.name,
        sacCode: service.sacCode,
        gstRate: String(service.gstRate),
        rate: service.rate,
        standardHours: service.standardHours,
        isActive: service.isActive,
      });
    }
  }, [service, reset, defaultSac, defaultGst]);

  const submit = handleSubmit((values) => onSave(values, setError));

  return (
    <Modal
      open={Boolean(service)}
      onClose={onClose}
      size="md"
      title={service === "new" ? "New labour service" : `Edit ${service && service.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} loadingText="Saving…">
            Save service
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <FormGrid>
          <Field label="Service name" required error={errors.name?.message} className="sm:col-span-2">
            {(p) => <Input {...p} placeholder="Periodic service" {...register("name")} />}
          </Field>
          <Field label="Code" error={errors.code?.message} helper="Optional short code, e.g. PS-01.">
            {(p) => <Input {...p} className="uppercase" maxLength={20} {...register("code")} />}
          </Field>
          <Field label="SAC code" required error={errors.sacCode?.message} helper="998714 = repair of motor vehicles.">
            {(p) => <Input {...p} inputMode="numeric" maxLength={8} {...register("sacCode")} />}
          </Field>
          <Field label="Rate" required error={errors.rate?.message} helper="Before GST.">
            {(p) => <Input {...p} type="number" min={0} step="0.01" align="right" suffix="₹" {...register("rate")} />}
          </Field>
          <Field label="GST rate" error={errors.gstRate?.message}>
            {(p) => (
              <Select {...p} {...register("gstRate")}>
                {GST_RATES.map((r) => (
                  <option key={r} value={r}>
                    {r}%
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            label="Standard hours"
            error={errors.standardHours?.message}
            helper="For technician productivity reports."
          >
            {(p) => (
              <Input
                {...p}
                type="number"
                min={0}
                step="0.25"
                align="right"
                suffix="hrs"
                {...register("standardHours")}
              />
            )}
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox
              label="Active"
              description="Inactive services can't be added to bills."
              {...register("isActive")}
            />
          </div>
        </FormGrid>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
