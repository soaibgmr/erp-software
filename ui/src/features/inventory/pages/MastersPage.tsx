import { useEffect, useState, type ReactNode } from "react";
import { useForm, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Car, FolderTree, Plus, Receipt, Tag } from "lucide-react";
import type { z } from "zod";
import {
  brandCreateSchema,
  categoryCreateSchema,
  GST_RATES,
  HSN_SAC_KINDS,
  hsnSacCreateSchema,
  vehicleMakeCreateSchema,
  vehicleModelCreateSchema,
} from "@automobile/shared";
import { useAuth } from "@/app/auth";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Controls";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Field, FormGrid, Input, Select, Textarea } from "@/components/ui/Field";
import { Menu } from "@/components/ui/Menu";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { Brand, Category, HsnSac, VehicleMake, VehicleModel } from "@/lib/types";
import { applyServerErrors, cn, errorMessage } from "@/lib/utils";
import { useCatalog, useDeleteCatalog, useSaveCatalog, type CatalogResource } from "../api";
import { InventoryTabs } from "../components/common";

export function MastersPage() {
  const { branch } = useAuth();
  return (
    <>
      <PageHeader
        title="Inventory"
        description={branch ? `Parts, stock and labour for ${branch.name}.` : "Parts, stock and labour services."}
      />
      <InventoryTabs />
      <div className="grid gap-6 xl:grid-cols-2">
        <CategoriesCard />
        <BrandsCard />
        <HsnCard />
        <VehiclesCard />
      </div>
    </>
  );
}

// ---------- Generic list + modal form for one catalog resource ----------

interface FormField {
  name: string;
  label: string;
  kind?: "text" | "textarea" | "select";
  options?: { value: string; label: string }[];
  helper?: string;
  required?: boolean;
  className?: string;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
}

interface SectionProps<T extends { id: string; name?: string }> {
  resource: CatalogResource;
  noun: string;
  rows: T[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  columns: Column<T>[];
  schema: z.ZodObject;
  fields: FormField[];
  empty: { icon: typeof Tag; title: string; description: string };
  label: (row: T) => string;
  toForm: (row: T | null) => FieldValues;
  // Extra body fields (e.g. the make for a new model).
  extraBody?: Record<string, unknown>;
  onRowClick?: (row: T) => void;
  // Rendered as the "Add" trigger; null hides it.
  addLabel: string;
  editing: T | "new" | null;
  setEditing: (v: T | "new" | null) => void;
}

function CatalogSection<T extends { id: string; name?: string }>(p: SectionProps<T>) {
  const toast = useToast();
  const save = useSaveCatalog(p.resource);
  const remove = useDeleteCatalog(p.resource);
  const [deleting, setDeleting] = useState<T | null>(null);

  const columns: Column<T>[] = [
    ...p.columns,
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <Menu
          items={[
            { label: "Edit", onSelect: () => p.setEditing(row) },
            { label: `Delete ${p.noun}`, destructive: true, onSelect: () => setDeleting(row) },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={p.rows}
        rowKey={(r) => r.id}
        loading={p.loading}
        error={p.error}
        onRetry={p.onRetry}
        onRowClick={p.onRowClick}
        empty={
          <EmptyState
            icon={p.empty.icon}
            title={p.empty.title}
            description={p.empty.description}
            action={
              <Button size="sm" onClick={() => p.setEditing("new")}>
                {p.addLabel}
              </Button>
            }
          />
        }
      />

      <CatalogForm
        open={Boolean(p.editing)}
        title={p.editing === "new" ? p.addLabel : `Edit ${p.editing ? p.label(p.editing) : ""}`}
        schema={p.schema}
        fields={p.fields}
        defaults={p.toForm(p.editing === "new" ? null : p.editing)}
        saving={save.isPending}
        onClose={() => p.setEditing(null)}
        onSave={async (values, setError) => {
          try {
            const isNew = p.editing === "new";
            await save.mutateAsync({
              id: isNew ? undefined : (p.editing as T).id,
              body: { ...values, ...(isNew ? p.extraBody : {}) },
            });
            toast({ message: `${p.noun.charAt(0).toUpperCase()}${p.noun.slice(1)} ${isNew ? "added" : "saved"}` });
            p.setEditing(null);
          } catch (err) {
            const message = applyServerErrors(err, setError);
            if (message) toast({ message, tone: "error" });
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting ? p.label(deleting) : ""}?`}
        body={`The ${p.noun} disappears from lists and forms. Anything still using it has to be moved first.`}
        cancelLabel="Keep it"
        confirmLabel={`Delete ${p.noun}`}
        loading={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(deleting!.id);
            toast({ message: `${p.label(deleting!)} deleted` });
          } catch (err) {
            // 409: still used by items or models.
            toast({ message: errorMessage(err), tone: "error" });
          }
          setDeleting(null);
        }}
      />
    </>
  );
}

function CatalogForm({
  open,
  title,
  schema,
  fields,
  defaults,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  schema: z.ZodObject;
  fields: FormField[];
  defaults: FieldValues;
  saving: boolean;
  onClose: () => void;
  onSave: (values: FieldValues, setError: ReturnType<typeof useForm<FieldValues>>["setError"]) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FieldValues>({ resolver: zodResolver(schema as never) });

  // Reset whenever the dialog opens for a different row.
  const key = JSON.stringify(defaults);
  useEffect(() => {
    if (open) reset(JSON.parse(key));
  }, [open, key, reset]);

  const submit = handleSubmit((values) => onSave(values, setError));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} loadingText="Saving…">
            Save
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <FormGrid>
          {fields.map((f) => (
            <Field
              key={f.name}
              label={f.label}
              required={f.required}
              helper={f.helper}
              error={errors[f.name]?.message as string | undefined}
              className={f.className ?? "sm:col-span-2"}
            >
              {(props) =>
                f.kind === "textarea" ? (
                  <Textarea {...props} rows={3} {...register(f.name)} />
                ) : f.kind === "select" ? (
                  <Select {...props} {...register(f.name)}>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input {...props} {...f.inputProps} {...register(f.name)} />
                )
              }
            </Field>
          ))}
        </FormGrid>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button size="sm" variant="outline" icon={<Plus className="size-4" />} onClick={onClick}>
      {children}
    </Button>
  );
}

const count = (n: number, noun: string) => (
  <span className={cn("tabular", n === 0 && "text-muted")}>
    {n} {noun}
    {n === 1 ? "" : "s"}
  </span>
);

// ---------- Cards ----------

function CategoriesCard() {
  const q = useCatalog("categories");
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  return (
    <Card>
      <CardHeader
        title="Categories"
        subtitle="Group parts for POS chips and reports."
        actions={<AddButton onClick={() => setEditing("new")}>Add</AddButton>}
      />
      <CatalogSection<Category>
        resource="categories"
        noun="category"
        addLabel="New category"
        rows={q.data}
        loading={q.isPending}
        error={q.error}
        onRetry={() => q.refetch()}
        editing={editing}
        setEditing={setEditing}
        schema={categoryCreateSchema}
        label={(c) => c.name}
        toForm={(c) => ({ name: c?.name ?? "", description: c?.description ?? "" })}
        fields={[
          { name: "name", label: "Name", required: true, inputProps: { placeholder: "Filters" } },
          { name: "description", label: "Description", kind: "textarea" },
        ]}
        empty={{
          icon: FolderTree,
          title: "No categories yet",
          description: "Filters, Brakes, Lubricants, Electricals…",
        }}
        columns={[
          {
            key: "name",
            header: "Category",
            cell: (c) => (
              <div className="min-w-0">
                <p className="font-medium text-ink">{c.name}</p>
                {c.description && <p className="truncate text-helper text-slate">{c.description}</p>}
              </div>
            ),
          },
          { key: "items", header: "Items", align: "right", cell: (c) => count(c.itemCount, "item") },
        ]}
      />
    </Card>
  );
}

function BrandsCard() {
  const q = useCatalog("brands");
  const [editing, setEditing] = useState<Brand | "new" | null>(null);
  return (
    <Card>
      <CardHeader
        title="Brands"
        subtitle="Part manufacturers."
        actions={<AddButton onClick={() => setEditing("new")}>Add</AddButton>}
      />
      <CatalogSection<Brand>
        resource="brands"
        noun="brand"
        addLabel="New brand"
        rows={q.data}
        loading={q.isPending}
        error={q.error}
        onRetry={() => q.refetch()}
        editing={editing}
        setEditing={setEditing}
        schema={brandCreateSchema}
        label={(b) => b.name}
        toForm={(b) => ({ name: b?.name ?? "" })}
        fields={[{ name: "name", label: "Name", required: true, inputProps: { placeholder: "Bosch" } }]}
        empty={{
          icon: Tag,
          title: "No brands yet",
          description: "Bosch, Castrol, Minda… Add them here or let a CSV import create them.",
        }}
        columns={[
          { key: "name", header: "Brand", cell: (b) => <span className="font-medium text-ink">{b.name}</span> },
          { key: "items", header: "Items", align: "right", cell: (b) => count(b.itemCount, "item") },
        ]}
      />
    </Card>
  );
}

function HsnCard() {
  const q = useCatalog("hsnSac");
  const [editing, setEditing] = useState<HsnSac | "new" | null>(null);
  return (
    <Card>
      <CardHeader
        title="HSN / SAC codes"
        subtitle="Tax codes with their GST rate, printed on invoices."
        actions={<AddButton onClick={() => setEditing("new")}>Add</AddButton>}
      />
      <CatalogSection<HsnSac>
        resource="hsnSac"
        noun="code"
        addLabel="New HSN / SAC code"
        rows={q.data}
        loading={q.isPending}
        error={q.error}
        onRetry={() => q.refetch()}
        editing={editing}
        setEditing={setEditing}
        schema={hsnSacCreateSchema}
        label={(h) => h.code}
        toForm={(h) => ({
          code: h?.code ?? "",
          kind: h?.kind ?? "HSN",
          description: h?.description ?? "",
          gstRate: String(h?.gstRate ?? 18),
        })}
        fields={[
          {
            name: "code",
            label: "Code",
            required: true,
            className: "",
            inputProps: { inputMode: "numeric", maxLength: 8, placeholder: "8421" },
          },
          {
            name: "kind",
            label: "Type",
            kind: "select",
            className: "",
            options: HSN_SAC_KINDS.map((k) => ({ value: k, label: k === "HSN" ? "HSN (goods)" : "SAC (services)" })),
          },
          {
            name: "description",
            label: "Description",
            required: true,
            inputProps: { placeholder: "Oil filters for engines" },
          },
          {
            name: "gstRate",
            label: "GST rate",
            kind: "select",
            className: "",
            options: GST_RATES.map((r) => ({ value: String(r), label: `${r}%` })),
          },
        ]}
        empty={{
          icon: Receipt,
          title: "No HSN / SAC codes yet",
          description: "Add the codes you use so item forms can fill the GST rate.",
        }}
        columns={[
          {
            key: "code",
            header: "Code",
            cell: (h) => (
              <span className="inline-flex items-center gap-2">
                <span className="font-mono text-helper font-medium">{h.code}</span>
                <Badge dot={false}>{h.kind}</Badge>
              </span>
            ),
          },
          {
            key: "description",
            header: "Description",
            cell: (h) => <span className="line-clamp-2 text-slate">{h.description}</span>,
          },
          { key: "gst", header: "GST", align: "right", cell: (h) => `${h.gstRate}%` },
        ]}
      />
    </Card>
  );
}

function VehiclesCard() {
  const makes = useCatalog("vehicleMakes");
  const [makeEditing, setMakeEditing] = useState<VehicleMake | "new" | null>(null);
  const [modelEditing, setModelEditing] = useState<VehicleModel | "new" | null>(null);
  const [selected, setSelected] = useState<string | undefined>();
  const make = makes.data?.find((m) => m.id === selected) ?? makes.data?.[0];
  const models = useCatalog("vehicleModels", { makeId: make?.id });

  return (
    <Card>
      <CardHeader
        title="Vehicle makes & models"
        subtitle="Used for part compatibility. Pick a make to see its models."
        actions={<AddButton onClick={() => setMakeEditing("new")}>Add make</AddButton>}
      />
      <CatalogSection<VehicleMake>
        resource="vehicleMakes"
        noun="make"
        addLabel="New make"
        rows={makes.data}
        loading={makes.isPending}
        error={makes.error}
        onRetry={() => makes.refetch()}
        editing={makeEditing}
        setEditing={setMakeEditing}
        schema={vehicleMakeCreateSchema}
        label={(m) => m.name}
        toForm={(m) => ({ name: m?.name ?? "" })}
        fields={[{ name: "name", label: "Make", required: true, inputProps: { placeholder: "Maruti Suzuki" } }]}
        empty={{
          icon: Car,
          title: "No vehicle makes yet",
          description: "Add the makes you service, then their models.",
        }}
        onRowClick={(m) => setSelected(m.id)}
        columns={[
          {
            key: "name",
            header: "Make",
            cell: (m) => (
              <span className={cn("font-medium", m.id === make?.id ? "text-navy-900" : "text-ink")}>
                {m.id === make?.id && (
                  <span className="mr-2 inline-block size-2 rounded-full bg-yellow-500" aria-label="Selected" />
                )}
                {m.name}
              </span>
            ),
          },
          { key: "models", header: "Models", align: "right", cell: (m) => count(m.modelCount, "model") },
        ]}
      />

      {make && (
        <div className="border-t border-border">
          <div className="flex items-center justify-between gap-3 px-6 py-3">
            <p className="text-body font-semibold text-ink">{make.name} models</p>
            <AddButton onClick={() => setModelEditing("new")}>Add model</AddButton>
          </div>
          <CatalogSection<VehicleModel>
            resource="vehicleModels"
            noun="model"
            addLabel={`New ${make.name} model`}
            rows={models.data}
            loading={models.isPending}
            error={models.error}
            onRetry={() => models.refetch()}
            editing={modelEditing}
            setEditing={setModelEditing}
            schema={vehicleModelCreateSchema.omit({ makeId: true })}
            extraBody={{ makeId: make.id }}
            label={(m) => `${m.makeName} ${m.name}`}
            toForm={(m) => ({ name: m?.name ?? "" })}
            fields={[{ name: "name", label: "Model", required: true, inputProps: { placeholder: "Swift" } }]}
            empty={{
              icon: Car,
              title: `No ${make.name} models yet`,
              description: "Add models so parts can be marked compatible.",
            }}
            columns={[{ key: "name", header: "Model", cell: (m) => <span className="text-ink">{m.name}</span> }]}
          />
        </div>
      )}
    </Card>
  );
}
