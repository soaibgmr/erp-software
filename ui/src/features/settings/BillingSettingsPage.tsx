import { useEffect, type ReactNode } from "react";
import { useForm, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import {
  GST_RATES,
  inventorySettingsSchema,
  PAYMENT_MODES,
  posSettingsSchema,
  PRINT_FORMAT_INFO,
  PRINT_FORMATS,
  type PrintFormat,
  printSettingsSchema,
  taxSettingsSchema,
  type SettingsGroup,
} from "@automobile/shared";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Checkbox, Field, FormGrid, Input, Select, Textarea } from "@/components/ui/Field";
import { ErrorBanner, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { applyServerErrors, errorMessage } from "@/lib/utils";
import { useSettings, useUpdateSettings } from "./api";

const paymentLabels: Record<(typeof PAYMENT_MODES)[number], string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  CREDIT: "Pay later",
};

export function BillingSettingsPage() {
  const query = useSettings();
  if (query.isPending) return <Skeleton className="h-[640px] w-full rounded-card" />;
  if (query.error)
    return (
      <ErrorBanner title="Couldn't load settings" message={errorMessage(query.error)} onRetry={() => query.refetch()} />
    );
  const s = query.data;

  return (
    <div className="space-y-6">
      <SettingsCard
        group="tax"
        schema={taxSettingsSchema}
        values={s.tax}
        title="Tax"
        subtitle="Defaults for new items and labour services."
      >
        {({ register, errors }) => (
          <FormGrid>
            <Field label="Default GST rate" error={errors.defaultGstRate}>
              {(p) => (
                <Select {...p} {...register("defaultGstRate")}>
                  {GST_RATES.map((r) => (
                    <option key={r} value={r}>
                      {r}%
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field
              label="Labour SAC code"
              error={errors.defaultLabourSac}
              helper="998714 = maintenance and repair of motor vehicles."
            >
              {(p) => <Input {...p} inputMode="numeric" {...register("defaultLabourSac")} />}
            </Field>
            <Checkbox
              className="sm:col-span-2"
              label="Prices include GST"
              description="Sale prices are entered tax-inclusive (MRP); taxable value is back-calculated."
              {...register("pricesIncludeTax")}
            />
          </FormGrid>
        )}
      </SettingsCard>

      <SettingsCard
        group="print"
        schema={printSettingsSchema}
        values={s.print}
        title="Invoice printing"
        subtitle="Layout and the text at the bottom of every invoice."
      >
        {({ register, errors }) => (
          <FormGrid>
            <fieldset className="sm:col-span-2">
              <legend className="text-body font-medium text-ink">Bill paper size</legend>
              <div className="mt-1.5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {PRINT_FORMATS.map((f) => (
                  <label
                    key={f}
                    className="flex cursor-pointer flex-col items-center gap-2 rounded-card border border-border bg-surface p-3 text-center transition-colors hover:bg-navy-50 has-[:checked]:border-navy-700 has-[:checked]:bg-navy-50 has-[:checked]:ring-2 has-[:checked]:ring-navy-600/25 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-navy-600/40"
                  >
                    <PaperPreview format={f} />
                    <span className="flex items-center gap-2">
                      <input type="radio" value={f} className="size-4 accent-navy-700" {...register("defaultFormat")} />
                      <span className="text-body font-medium text-ink">{PRINT_FORMAT_INFO[f].short}</span>
                    </span>
                    <span className="text-helper text-slate">{PAPER_HINT[f]}</span>
                  </label>
                ))}
              </div>
              <p className={errors.defaultFormat ? "mt-1.5 text-helper text-danger" : "mt-1.5 text-helper text-slate"}>
                {errors.defaultFormat ??
                  "Used everywhere bills print: after a POS charge, the invoice list and the invoice page."}
              </p>
            </fieldset>
            <Field label="Signature label" error={errors.signatureLabel} helper="Defaults to “For [business name]”.">
              {(p) => <Input {...p} {...register("signatureLabel")} />}
            </Field>
            <Field
              label="Terms"
              error={errors.invoiceTerms}
              className="sm:col-span-2"
              helper="Parts warranty, labour warranty, returns and payment terms."
            >
              {(p) => <Textarea {...p} rows={4} {...register("invoiceTerms")} />}
            </Field>
            <Field label="Footer" error={errors.footerText} className="sm:col-span-2">
              {(p) => <Input {...p} {...register("footerText")} />}
            </Field>
            <Checkbox
              className="sm:col-span-2"
              label="Print next service due"
              description="Adds the next service km and date to workshop invoices."
              {...register("showNextServiceDue")}
            />
          </FormGrid>
        )}
      </SettingsCard>

      <SettingsCard
        group="pos"
        schema={posSettingsSchema}
        values={s.pos}
        title="POS billing"
        subtitle="Counter rules. Discounts above the limit need a manager."
      >
        {({ register, errors }) => (
          <FormGrid>
            <Field label="Max discount without approval" error={errors.maxDiscountPercent}>
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  align="right"
                  suffix="%"
                  {...register("maxDiscountPercent")}
                />
              )}
            </Field>
            <Field label="Default payment mode" error={errors.defaultPaymentMode}>
              {(p) => (
                <Select {...p} {...register("defaultPaymentMode")}>
                  {PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {paymentLabels[m]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Checkbox
              label="Allow negative stock"
              description="Bill items even when stock shows zero."
              {...register("allowNegativeStock")}
            />
            <Checkbox label="Print right after charging" {...register("autoPrintAfterCharge")} />
          </FormGrid>
        )}
      </SettingsCard>

      <SettingsCard
        group="inventory"
        schema={inventorySettingsSchema}
        values={s.inventory}
        title="Stock"
        subtitle="Adjustments above this value need a manager (stock.approve)."
      >
        {({ register, errors }) => (
          <FormGrid>
            <Field
              label="Adjustment approval limit"
              error={errors.adjustmentApprovalLimit}
              helper="Value at purchase price. Smaller adjustments post at once."
            >
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  min={0}
                  step="0.01"
                  align="right"
                  suffix="₹"
                  {...register("adjustmentApprovalLimit")}
                />
              )}
            </Field>
          </FormGrid>
        )}
      </SettingsCard>
    </div>
  );
}

// One card = one settings group with its own Save.
function SettingsCard<S extends z.ZodObject>({
  group,
  schema,
  values,
  title,
  subtitle,
  children,
}: {
  group: SettingsGroup;
  schema: S;
  values: z.output<S>;
  title: string;
  subtitle: string;
  children: (form: {
    register: ReturnType<typeof useForm<FieldValues>>["register"];
    errors: Record<string, string | undefined>;
  }) => ReactNode;
}) {
  const toast = useToast();
  const update = useUpdateSettings(group);
  const form = useForm<FieldValues>({ resolver: zodResolver(schema as never), defaultValues: values });
  const {
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = form;

  useEffect(() => reset(values), [values, reset]);

  const onSubmit = handleSubmit(async (v) => {
    try {
      await update.mutateAsync(v);
      toast({ message: `${title} settings saved` });
    } catch (err) {
      const message = applyServerErrors(err, setError);
      if (message) toast({ message, tone: "error" });
    }
  });

  const flatErrors = Object.fromEntries(Object.entries(errors).map(([k, e]) => [k, e?.message as string | undefined]));

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardHeader
          title={title}
          subtitle={subtitle}
          actions={
            <Button size="sm" type="submit" disabled={!isDirty} loading={update.isPending}>
              Save
            </Button>
          }
        />
        <CardBody>{children({ register: form.register, errors: flatErrors })}</CardBody>
      </Card>
    </form>
  );
}

const PAPER_HINT: Record<PrintFormat, string> = {
  A4: "Full tax invoice, laser/inkjet",
  A5: "Half-page tax invoice",
  THERMAL_80: "Counter receipt, 3-inch roll",
  THERMAL_58: "Small receipt, 2-inch roll",
};

// Miniature of each paper, drawn to scale against the others (A4 sheet, A5 sheet, receipt rolls).
function PaperPreview({ format }: { format: PrintFormat }) {
  const receipt = PRINT_FORMAT_INFO[format].receipt;
  const size: Record<PrintFormat, string> = {
    A4: "h-20 w-14",
    A5: "h-14 w-10",
    THERMAL_80: "h-20 w-8",
    THERMAL_58: "h-20 w-6",
  };
  const line = (w: string, strong = false) => (
    <span className={`block h-[3px] rounded-full ${strong ? "bg-navy-700" : "bg-border"} ${w}`} />
  );
  return (
    <span className="flex h-20 items-end justify-center" aria-hidden>
      <span
        className={`flex flex-col gap-[3px] border border-border bg-surface p-1.5 shadow-sm ${size[format]} ${
          receipt ? "items-center rounded-t-sm border-b-2" : "rounded-sm border-t-[3px] border-t-yellow-500"
        }`}
      >
        {receipt ? (
          <>
            {line("w-3/4", true)}
            {line("w-1/2")}
            <span className="my-0.5 block w-full border-t border-dashed border-border" />
            {line("w-full")}
            {line("w-full")}
            {line("w-full")}
            <span className="my-0.5 block w-full border-t border-dashed border-border" />
            {line("w-2/3", true)}
          </>
        ) : (
          <>
            <span className="flex justify-between">
              {line("w-1/3", true)}
              {line("w-1/4")}
            </span>
            <span className="mt-0.5 block h-2 w-full rounded-[2px] bg-navy-50" />
            {line("w-full")}
            {line("w-full")}
            {line("w-5/6")}
            <span className="mt-auto block h-[4px] w-1/2 self-end rounded-full bg-navy-900" />
          </>
        )}
      </span>
    </span>
  );
}
