import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useParams } from "react-router";
import { Plus, Search, X } from "lucide-react";
import type { z } from "zod";
import {
  barcodeSchema,
  formatINR,
  GST_RATES,
  ITEM_UNIT_LABELS,
  ITEM_UNITS,
  itemCreateSchema,
  priceWithTax,
} from "@automobile/shared";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Controls";
import { Checkbox, Field, FormGrid, Input, Select, Textarea } from "@/components/ui/Field";
import { ErrorBanner, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { ItemDetail } from "@/lib/types";
import { applyServerErrors, cn, errorMessage } from "@/lib/utils";
import { useSettings } from "@/features/settings/api";
import { useCatalog, useItem, useSaveItem } from "../api";

type FormInput = z.input<typeof itemCreateSchema>;
type FormOutput = z.output<typeof itemCreateSchema>;

const emptyForm: FormInput = {
  sku: "",
  name: "",
  oemPartNo: "",
  description: "",
  categoryId: "",
  brandId: "",
  hsnCode: "",
  gstRate: "18",
  unit: "PCS",
  mrp: "",
  salePrice: "",
  purchasePrice: "",
  taxInclusive: false,
  isActive: true,
  barcodes: [],
  compatibleModelIds: [],
};

const toForm = (i: ItemDetail): FormInput => ({
  sku: i.sku,
  name: i.name,
  oemPartNo: i.oemPartNo ?? "",
  description: i.description ?? "",
  categoryId: i.category?.id ?? "",
  brandId: i.brand?.id ?? "",
  hsnCode: i.hsnCode ?? "",
  gstRate: String(i.gstRate),
  unit: i.unit,
  mrp: i.mrp ?? "",
  salePrice: i.salePrice,
  purchasePrice: i.purchasePrice,
  taxInclusive: i.taxInclusive,
  isActive: i.isActive,
  barcodes: i.barcodes,
  compatibleModelIds: i.compatibleModels.map((m) => m.id),
});

export function ItemFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const existing = useItem(id);
  const save = useSaveItem(id);
  const settings = useSettings();
  const categories = useCatalog("categories");
  const brands = useCatalog("brands");
  const hsnCodes = useCatalog("hsnSac");

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isDirty, dirtyFields },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(itemCreateSchema), defaultValues: emptyForm });

  useEffect(() => {
    if (existing.data) reset(toForm(existing.data));
  }, [existing.data, reset]);

  // New items start at the business's default GST slab.
  const defaultGst = settings.data?.tax.defaultGstRate;
  useEffect(() => {
    if (!editing && defaultGst !== undefined && !dirtyFields.gstRate) setValue("gstRate", String(defaultGst));
  }, [editing, defaultGst, dirtyFields.gstRate, setValue]);

  // Picking a known HSN code applies its GST rate.
  const hsn = watch("hsnCode");
  useEffect(() => {
    const match = hsnCodes.data?.find((h) => h.code === hsn);
    if (match && dirtyFields.hsnCode) setValue("gstRate", String(match.gstRate), { shouldDirty: true });
  }, [hsn, hsnCodes.data, dirtyFields.hsnCode, setValue]);

  const salePrice = Number(watch("salePrice"));
  const gstRate = Number(watch("gstRate"));
  const taxInclusive = Boolean(watch("taxInclusive"));
  const mrp = Number(watch("mrp"));
  const barcodes = (watch("barcodes") ?? []) as string[];
  const modelIds = (watch("compatibleModelIds") ?? []) as string[];
  const gross = Number.isFinite(salePrice) && salePrice > 0 ? priceWithTax(salePrice, gstRate, taxInclusive) : null;

  const onSubmit = handleSubmit(async (values) => {
    try {
      const item = await save.mutateAsync(values);
      toast({ message: editing ? "Item updated" : `${item.name} added` });
      navigate(`/inventory/items/${item.id}`);
    } catch (err) {
      const message = applyServerErrors(err, setError);
      if (message) toast({ message, tone: "error" });
    }
  });

  if (editing && existing.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-96 w-full rounded-card" />
      </div>
    );
  }
  if (editing && existing.error) {
    return (
      <ErrorBanner
        title="Couldn't load this item"
        message={errorMessage(existing.error)}
        onRetry={() => existing.refetch()}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader
        breadcrumb={
          <>
            <Link to="/inventory" className="hover:text-navy-700">
              Inventory
            </Link>{" "}
            / {editing ? "Edit item" : "New item"}
          </>
        }
        title={editing ? `Edit ${existing.data?.name ?? "item"}` : "New item"}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Part details"
              subtitle="SKU is your own code; the POS also finds parts by OEM number and barcode."
            />
            <CardBody>
              <FormGrid>
                <Field label="SKU" required error={errors.sku?.message} helper="Letters, digits and - _ / .">
                  {(p) => (
                    <Input
                      {...p}
                      autoFocus={!editing}
                      className="font-mono uppercase"
                      placeholder="OF-BSH-2341"
                      {...register("sku")}
                    />
                  )}
                </Field>
                <Field label="Item name" required error={errors.name?.message}>
                  {(p) => <Input {...p} placeholder="Oil filter - Swift" {...register("name")} />}
                </Field>
                <Field label="OEM part number" error={errors.oemPartNo?.message}>
                  {(p) => <Input {...p} className="font-mono" {...register("oemPartNo")} />}
                </Field>
                <Field label="Unit" error={errors.unit?.message}>
                  {(p) => (
                    <Select {...p} {...register("unit")}>
                      {ITEM_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {ITEM_UNIT_LABELS[u]} ({u})
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Brand" error={errors.brandId?.message}>
                  {(p) => (
                    <Select {...p} {...register("brandId")}>
                      <option value="">No brand</option>
                      {brands.data?.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Category" error={errors.categoryId?.message}>
                  {(p) => (
                    <Select {...p} {...register("categoryId")}>
                      <option value="">No category</option>
                      {categories.data?.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Description" error={errors.description?.message} className="sm:col-span-2">
                  {(p) => <Textarea {...p} rows={2} {...register("description")} />}
                </Field>
                {editing && (
                  <Checkbox
                    className="sm:col-span-2"
                    label="Active"
                    description="Inactive items stay in history but can't be sold or searched at the POS."
                    {...register("isActive")}
                  />
                )}
              </FormGrid>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Pricing & tax" subtitle="Prices are without GST unless the item is tax-inclusive." />
            <CardBody>
              <FormGrid>
                <Field
                  label="HSN code"
                  error={errors.hsnCode?.message}
                  helper="Picking a saved code sets its GST rate."
                >
                  {(p) => (
                    <>
                      <Input
                        {...p}
                        inputMode="numeric"
                        maxLength={8}
                        list="hsn-codes"
                        className="font-mono"
                        {...register("hsnCode")}
                      />
                      <datalist id="hsn-codes">
                        {hsnCodes.data
                          ?.filter((h) => h.kind === "HSN")
                          .map((h) => (
                            <option key={h.id} value={h.code}>
                              {h.description} · {h.gstRate}%
                            </option>
                          ))}
                      </datalist>
                    </>
                  )}
                </Field>
                <Field label="GST rate" error={errors.gstRate?.message}>
                  {(p) => (
                    <Select {...p} {...register("gstRate")}>
                      {GST_RATES.map((r) => (
                        <option key={r} value={String(r)}>
                          {r}%
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field
                  label="Purchase price"
                  error={errors.purchasePrice?.message}
                  helper="Values stock adjustments and transfers."
                >
                  {(p) => (
                    <Input
                      {...p}
                      type="number"
                      min={0}
                      step="0.01"
                      align="right"
                      suffix="₹"
                      {...register("purchasePrice")}
                    />
                  )}
                </Field>
                <Field
                  label="Sale price"
                  required
                  error={errors.salePrice?.message}
                  helper={
                    gross !== null
                      ? `Price with GST ${formatINR(gross, { exact: true })}`
                      : taxInclusive
                        ? "Includes GST"
                        : "Before GST"
                  }
                >
                  {(p) => (
                    <Input
                      {...p}
                      type="number"
                      min={0}
                      step="0.01"
                      align="right"
                      suffix="₹"
                      {...register("salePrice")}
                    />
                  )}
                </Field>
                <Field
                  label="MRP"
                  error={errors.mrp?.message}
                  helper={
                    mrp > 0 && gross !== null && gross <= mrp
                      ? `${formatINR(mrp - gross, { exact: true })} below MRP`
                      : "Printed MRP, including taxes."
                  }
                >
                  {(p) => (
                    <Input {...p} type="number" min={0} step="0.01" align="right" suffix="₹" {...register("mrp")} />
                  )}
                </Field>
                <div className="flex items-end pb-2.5">
                  <Checkbox
                    label="Sale price includes GST"
                    description="Typical for MRP items."
                    {...register("taxInclusive")}
                  />
                </div>
              </FormGrid>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <BarcodesCard
            value={barcodes}
            error={
              errors.barcodes?.message ??
              (errors.barcodes as unknown as { [k: number]: { message?: string } } | undefined)?.[0]?.message
            }
            onChange={(v) => setValue("barcodes", v, { shouldDirty: true, shouldValidate: true })}
          />
          <VehicleModelsCard
            value={modelIds}
            error={errors.compatibleModelIds?.message}
            onChange={(v) => setValue("compatibleModelIds", v, { shouldDirty: true })}
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3 border-t border-border pt-5">
        <Button variant="ghost" onClick={() => navigate(editing ? `/inventory/items/${id}` : "/inventory")}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending} loadingText="Saving…" disabled={editing && !isDirty}>
          {editing ? "Save changes" : "Save item"}
        </Button>
      </div>
    </form>
  );
}

function BarcodesCard({
  value,
  error,
  onChange,
}: {
  value: string[];
  error?: string;
  onChange: (v: string[]) => void;
}) {
  const [text, setText] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const add = () => {
    const code = text.trim();
    if (!code) return;
    const check = barcodeSchema.safeParse(code);
    if (!check.success) return setLocalError(check.error.issues[0]?.message ?? "Invalid barcode");
    if (value.includes(code)) return setLocalError("Already added");
    onChange([...value, code]);
    setText("");
    setLocalError(null);
  };

  return (
    <Card>
      <CardHeader title="Barcodes" subtitle="Manufacturer barcodes the POS scanner reads." />
      <CardBody className="space-y-3">
        {value.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {value.map((code) => (
              <li
                key={code}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-canvas pr-1 pl-3 font-mono text-helper text-ink"
              >
                {code}
                <button
                  type="button"
                  aria-label={`Remove barcode ${code}`}
                  onClick={() => onChange(value.filter((c) => c !== code))}
                  className="inline-flex size-6 items-center justify-center rounded-full text-slate hover:bg-danger-50 hover:text-danger"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <Field
          label="Add barcode"
          error={localError ?? error}
          helper="Scan or type, then Enter. Leave empty to print labels with the SKU."
        >
          {(p) => (
            <div className="flex gap-2">
              <Input
                {...p}
                className="font-mono"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setLocalError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    add();
                  }
                }}
              />
              <Button variant="outline" icon={<Plus className="size-4" />} onClick={add}>
                Add
              </Button>
            </div>
          )}
        </Field>
      </CardBody>
    </Card>
  );
}

function VehicleModelsCard({
  value,
  error,
  onChange,
}: {
  value: string[];
  error?: string;
  onChange: (v: string[]) => void;
}) {
  const models = useCatalog("vehicleModels");
  const [filter, setFilter] = useState("");
  const selected = useMemo(() => new Set(value), [value]);

  const groups = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const map = new Map<string, { id: string; name: string }[]>();
    for (const m of models.data ?? []) {
      if (f && !`${m.makeName} ${m.name}`.toLowerCase().includes(f)) continue;
      map.set(m.makeName, [...(map.get(m.makeName) ?? []), { id: m.id, name: m.name }]);
    }
    return [...map.entries()];
  }, [models.data, filter]);

  const byId = new Map((models.data ?? []).map((m) => [m.id, m]));
  const toggle = (id: string) => onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <Card>
      <CardHeader title="Fits vehicles" subtitle="Helps the counter find the right part for a customer's vehicle." />
      <CardBody className="space-y-3">
        {value.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {value.map((id) => {
              const m = byId.get(id);
              return (
                <li
                  key={id}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-navy-50 pr-1 pl-3 text-helper text-navy-700"
                >
                  {m ? `${m.makeName} ${m.name}` : "Model"}
                  <button
                    type="button"
                    aria-label={`Remove ${m?.name ?? "model"}`}
                    onClick={() => toggle(id)}
                    className="inline-flex size-6 items-center justify-center rounded-full hover:bg-navy-100"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate" />
          <Input
            aria-label="Filter vehicle models"
            placeholder="Filter make or model"
            className="pl-9"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="max-h-72 overflow-y-auto rounded-input border border-border">
          {models.isPending ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3.5 w-40" />
            </div>
          ) : groups.length === 0 ? (
            <p className="p-3 text-helper text-slate">
              {models.data?.length
                ? "No models match."
                : "No vehicle models yet. Add makes and models under Categories & brands."}
            </p>
          ) : (
            groups.map(([make, list]) => (
              <fieldset key={make} className="border-b border-border px-3 py-2 last:border-0">
                <legend className="eyebrow pt-1 text-slate">{make}</legend>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 py-1">
                  {list.map((m) => (
                    <label
                      key={m.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 text-body",
                        selected.has(m.id) ? "text-navy-700" : "text-ink",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-navy-700"
                        checked={selected.has(m.id)}
                        onChange={() => toggle(m.id)}
                      />
                      {m.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))
          )}
        </div>
        {error && <p className="text-helper text-danger">{error}</p>}
      </CardBody>
    </Card>
  );
}
