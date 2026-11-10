import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { businessUpdateSchema, checkGstin, INDIAN_STATES } from "@automobile/shared";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, FormGrid, Input, Select } from "@/components/ui/Field";
import { ErrorBanner, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { Business } from "@/lib/types";
import { applyServerErrors, errorMessage, formatDateTime } from "@/lib/utils";
import { useBusiness, useUpdateBusiness } from "./api";

type FormInput = z.input<typeof businessUpdateSchema>;

const FIELDS = [
  "legalName",
  "tradeName",
  "address",
  "city",
  "pincode",
  "stateCode",
  "gstin",
  "phone",
  "email",
  "website",
  "bankName",
  "bankAccountNo",
  "bankIfsc",
  "upiId",
] as const;

const toForm = (b: Business): FormInput => Object.fromEntries(FIELDS.map((k) => [k, b[k] ?? ""])) as FormInput;

export function BusinessPage() {
  const query = useBusiness();
  const update = useUpdateBusiness();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormInput>({ resolver: zodResolver(businessUpdateSchema) });

  useEffect(() => {
    if (query.data) reset(toForm(query.data));
  }, [query.data, reset]);

  const gstin = watch("gstin");
  useEffect(() => {
    const check = gstin ? checkGstin(gstin) : null;
    if (check?.valid) setValue("stateCode", check.stateCode, { shouldDirty: true });
  }, [gstin, setValue]);

  if (query.isPending) return <Skeleton className="h-[480px] w-full rounded-card" />;
  if (query.error)
    return (
      <ErrorBanner
        title="Couldn't load the business profile"
        message={errorMessage(query.error)}
        onRetry={() => query.refetch()}
      />
    );

  const onSubmit = handleSubmit(async (values) => {
    try {
      await update.mutateAsync(values);
      toast({ message: "Business profile saved" });
    } catch (err) {
      const message = applyServerErrors(err, setError);
      if (message) toast({ message, tone: "error" });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Card>
        <CardHeader title="Business" subtitle="Printed at the top of every invoice." />
        <CardBody>
          <FormGrid>
            <Field label="Legal name" required error={errors.legalName?.message}>
              {(p) => <Input {...p} {...register("legalName")} />}
            </Field>
            <Field label="Trade name" error={errors.tradeName?.message}>
              {(p) => <Input {...p} {...register("tradeName")} />}
            </Field>
            <Field label="GSTIN" error={errors.gstin?.message}>
              {(p) => <Input {...p} className="uppercase" maxLength={15} {...register("gstin")} />}
            </Field>
            <Field label="State" required error={errors.stateCode?.message} helper="Decides CGST + SGST vs IGST.">
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
            <Field label="Address" error={errors.address?.message} className="sm:col-span-2">
              {(p) => <Input {...p} {...register("address")} />}
            </Field>
            <Field label="City" error={errors.city?.message}>
              {(p) => <Input {...p} {...register("city")} />}
            </Field>
            <Field label="PIN code" error={errors.pincode?.message}>
              {(p) => <Input {...p} inputMode="numeric" maxLength={6} {...register("pincode")} />}
            </Field>
            <Field label="Phone" error={errors.phone?.message}>
              {(p) => <Input {...p} inputMode="tel" {...register("phone")} />}
            </Field>
            <Field label="Email" error={errors.email?.message}>
              {(p) => <Input {...p} type="email" {...register("email")} />}
            </Field>
            <Field label="Website" error={errors.website?.message} className="sm:col-span-2">
              {(p) => <Input {...p} {...register("website")} />}
            </Field>
          </FormGrid>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Payment details" subtitle="Shown on invoices so B2B customers can pay by transfer or UPI." />
        <CardBody>
          <FormGrid>
            <Field label="Bank name" error={errors.bankName?.message}>
              {(p) => <Input {...p} {...register("bankName")} />}
            </Field>
            <Field label="Account number" error={errors.bankAccountNo?.message}>
              {(p) => <Input {...p} {...register("bankAccountNo")} />}
            </Field>
            <Field label="IFSC" error={errors.bankIfsc?.message}>
              {(p) => <Input {...p} className="uppercase" maxLength={11} {...register("bankIfsc")} />}
            </Field>
            <Field label="UPI ID" error={errors.upiId?.message}>
              {(p) => <Input {...p} placeholder="business@upi" {...register("upiId")} />}
            </Field>
          </FormGrid>
        </CardBody>
      </Card>

      <div className="flex items-center justify-end gap-4">
        <span className="text-helper text-slate">Last saved {formatDateTime(query.data.updatedAt)}</span>
        <Button type="submit" loading={update.isPending} loadingText="Saving…" disabled={!isDirty}>
          Save profile
        </Button>
      </div>
    </form>
  );
}
