import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Plus } from "lucide-react";
import type { z } from "zod";
import { branchCreateSchema, checkGstin, formatMobile, INDIAN_STATES, stateName } from "@erp-software/shared";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Checkbox, Field, FormGrid, Input, Select } from "@/components/ui/Field";
import { Menu } from "@/components/ui/Menu";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { Branch } from "@/lib/types";
import { applyServerErrors, errorMessage } from "@/lib/utils";
import { useBranches, useDeleteBranch, useSaveBranch } from "./api";

type FormInput = z.input<typeof branchCreateSchema>;

const empty: FormInput = {
  code: "",
  name: "",
  address: "",
  city: "",
  pincode: "",
  stateCode: "32",
  gstin: "",
  phone: "",
  isActive: true,
};

export function BranchesPage() {
  const query = useBranches(true);
  const save = useSaveBranch();
  const remove = useDeleteBranch();
  const toast = useToast();
  const [editing, setEditing] = useState<Branch | "new" | null>(null);
  const [deleting, setDeleting] = useState<Branch | null>(null);

  const toggleActive = async (b: Branch) => {
    try {
      await save.mutateAsync({ id: b.id, body: { isActive: !b.isActive } });
      toast({ message: `${b.name} ${b.isActive ? "deactivated" : "activated"}` });
    } catch (err) {
      toast({ message: errorMessage(err), tone: "error" });
    }
  };

  const columns: Column<Branch>[] = [
    {
      key: "name",
      header: "Branch",
      cell: (b) => (
        <div>
          <p className="font-medium text-ink">{b.name}</p>
          <p className="text-helper text-slate">{[b.city, b.address].filter(Boolean).join(" · ") || "—"}</p>
        </div>
      ),
    },
    { key: "code", header: "Code", cell: (b) => <span className="font-mono text-helper">{b.code}</span> },
    { key: "state", header: "State", cell: (b) => `${b.stateCode} · ${stateName(b.stateCode) ?? ""}` },
    { key: "gstin", header: "GSTIN", cell: (b) => b.gstin ?? <span className="text-muted">Business GSTIN</span> },
    {
      key: "status",
      header: "Status",
      cell: (b) => (b.isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (b) => (
        <Menu
          items={[
            { label: "Edit", onSelect: () => setEditing(b) },
            { label: b.isActive ? "Deactivate" : "Activate", onSelect: () => void toggleActive(b) },
            { label: "Delete branch", destructive: true, onSelect: () => setDeleting(b) },
          ]}
        />
      ),
    },
  ];

  return (
    <Card>
      <CardHeader
        title="Branches"
        subtitle="Each branch has its own stock, counters and number series."
        actions={
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
            New branch
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={query.data}
        rowKey={(b) => b.id}
        loading={query.isPending}
        error={query.error}
        onRetry={() => query.refetch()}
        empty={
          <EmptyState
            icon={Building2}
            title="No branches yet"
            action={<Button onClick={() => setEditing("new")}>New branch</Button>}
          />
        }
      />

      <BranchForm
        branch={editing}
        saving={save.isPending}
        onClose={() => setEditing(null)}
        onSave={async (values, setError) => {
          try {
            const b = await save.mutateAsync({ id: editing === "new" ? undefined : editing?.id, body: values });
            toast({ message: editing === "new" ? `${b.name} created` : `${b.name} saved` });
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
        body="Users lose access to this branch. Its records stay in reports. This can't be undone."
        cancelLabel="Keep branch"
        confirmLabel="Delete branch"
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
    </Card>
  );
}

function BranchForm({
  branch,
  saving,
  onClose,
  onSave,
}: {
  branch: Branch | "new" | null;
  saving: boolean;
  onClose: () => void;
  onSave: (values: unknown, setError: ReturnType<typeof useForm<FormInput>>["setError"]) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormInput>({ resolver: zodResolver(branchCreateSchema), defaultValues: empty });

  useEffect(() => {
    if (branch === "new") reset(empty);
    else if (branch)
      reset({
        code: branch.code,
        name: branch.name,
        address: branch.address ?? "",
        city: branch.city ?? "",
        pincode: branch.pincode ?? "",
        stateCode: branch.stateCode,
        gstin: branch.gstin ?? "",
        phone: branch.phone ? formatMobile(branch.phone) : "",
        isActive: branch.isActive,
      });
  }, [branch, reset]);

  const gstin = watch("gstin");
  useEffect(() => {
    const check = gstin ? checkGstin(gstin) : null;
    if (check?.valid) setValue("stateCode", check.stateCode);
  }, [gstin, setValue]);

  const submit = handleSubmit((values) => onSave(values, setError));

  return (
    <Modal
      open={Boolean(branch)}
      onClose={onClose}
      size="md"
      title={branch === "new" ? "New branch" : `Edit ${branch && branch.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} loadingText="Saving…">
            Save branch
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <FormGrid>
          <Field label="Branch name" required error={errors.name?.message}>
            {(p) => <Input {...p} placeholder="Main branch" {...register("name")} />}
          </Field>
          <Field label="Code" required error={errors.code?.message} helper="Short, e.g. KOC. Shown on reports.">
            {(p) => <Input {...p} className="uppercase" maxLength={10} {...register("code")} />}
          </Field>
          <Field label="Address" error={errors.address?.message} className="sm:col-span-2">
            {(p) => <Input {...p} {...register("address")} />}
          </Field>
          <Field label="City" error={errors.city?.message}>
            {(p) => <Input {...p} {...register("city")} />}
          </Field>
          <Field label="PIN code" error={errors.pincode?.message}>
            {(p) => <Input {...p} inputMode="numeric" maxLength={6} {...register("pincode")} />}
          </Field>
          <Field label="State" required error={errors.stateCode?.message}>
            {(p) => (
              <Select {...p} {...register("stateCode")}>
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            label="Branch GSTIN"
            error={errors.gstin?.message}
            helper="Only if registered separately (e.g. another state)."
          >
            {(p) => <Input {...p} className="uppercase" maxLength={15} {...register("gstin")} />}
          </Field>
          <Field label="Phone" error={errors.phone?.message}>
            {(p) => <Input {...p} inputMode="tel" {...register("phone")} />}
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox label="Active" description="Inactive branches can't be selected." {...register("isActive")} />
          </div>
        </FormGrid>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
