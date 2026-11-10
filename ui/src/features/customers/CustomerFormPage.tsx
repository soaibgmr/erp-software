import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import type { z } from "zod";
import {
  CUSTOMER_TYPE_LABELS,
  CUSTOMER_TYPES,
  checkGstin,
  customerCreateSchema,
  INDIAN_STATES,
} from "@erp-software/shared";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Controls";
import { Field, FormGrid, Input, Select, Textarea } from "@/components/ui/Field";
import { ErrorBanner, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { Customer } from "@/lib/types";
import { applyServerErrors, errorMessage } from "@/lib/utils";
import { useCustomer, useSaveCustomer } from "./api";

type FormInput = z.input<typeof customerCreateSchema>;
type FormOutput = z.output<typeof customerCreateSchema>;

const emptyForm: FormInput = {
  type: "RETAIL",
  name: "",
  mobile: "",
  alternatePhone: "",
  email: "",
  address: "",
  city: "",
  pincode: "",
  stateCode: "",
  gstin: "",
  creditLimit: "0",
  creditDays: "0",
  notes: "",
};

const toForm = (c: Customer): FormInput => ({
  type: c.type,
  name: c.name,
  mobile: c.mobile,
  alternatePhone: c.alternatePhone ?? "",
  email: c.email ?? "",
  address: c.address ?? "",
  city: c.city ?? "",
  pincode: c.pincode ?? "",
  stateCode: c.stateCode ?? "",
  gstin: c.gstin ?? "",
  creditLimit: c.creditLimit,
  creditDays: String(c.creditDays),
  notes: c.notes ?? "",
});

export function CustomerFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  // ?mobile= pre-fills the number, e.g. from the POS "New customer" link after a lookup found no one.
  const [params] = useSearchParams();
  const prefillMobile = editing ? "" : (params.get("mobile") ?? "").trim();
  const navigate = useNavigate();
  const toast = useToast();
  const existing = useCustomer(id);
  const save = useSaveCustomer(id);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(customerCreateSchema),
    defaultValues: { ...emptyForm, mobile: prefillMobile },
  });

  useEffect(() => {
    if (existing.data) reset(toForm(existing.data));
  }, [existing.data, reset]);

  // A valid GSTIN fixes the place of supply to its state.
  const gstin = watch("gstin");
  const type = watch("type");
  useEffect(() => {
    const check = gstin ? checkGstin(gstin) : null;
    if (check?.valid) setValue("stateCode", check.stateCode, { shouldDirty: true });
  }, [gstin, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const customer = await save.mutateAsync(values);
      toast({ message: editing ? "Customer updated" : `${customer.name} added` });
      navigate(`/customers/${customer.id}`);
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
        title="Couldn't load this customer"
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
            <Link to="/customers" className="hover:text-navy-700">
              Customers
            </Link>{" "}
            / {editing ? "Edit" : "New"}
          </>
        }
        title={editing ? `Edit ${existing.data?.name ?? "customer"}` : "New customer"}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Contact" subtitle="Mobile is the key: the POS finds customers by it." />
            <CardBody>
              <FormGrid>
                <Field label="Customer name" required error={errors.name?.message}>
                  {(p) => <Input {...p} autoFocus={!editing} {...register("name")} />}
                </Field>
                <Field label="Customer type" error={errors.type?.message}>
                  {(p) => (
                    <Select {...p} {...register("type")}>
                      {CUSTOMER_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {CUSTOMER_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Mobile" required error={errors.mobile?.message}>
                  {(p) => <Input {...p} inputMode="tel" placeholder="98470 12345" {...register("mobile")} />}
                </Field>
                <Field label="Alternate phone" error={errors.alternatePhone?.message}>
                  {(p) => <Input {...p} inputMode="tel" {...register("alternatePhone")} />}
                </Field>
                <Field label="Email" error={errors.email?.message} className="sm:col-span-2">
                  {(p) => <Input {...p} type="email" {...register("email")} />}
                </Field>
              </FormGrid>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Address & GST" subtitle="Place of supply decides CGST + SGST or IGST on invoices." />
            <CardBody>
              <FormGrid>
                <Field label="Address" error={errors.address?.message} className="sm:col-span-2">
                  {(p) => <Input {...p} {...register("address")} />}
                </Field>
                <Field label="City" error={errors.city?.message}>
                  {(p) => <Input {...p} {...register("city")} />}
                </Field>
                <Field label="PIN code" error={errors.pincode?.message}>
                  {(p) => <Input {...p} inputMode="numeric" maxLength={6} {...register("pincode")} />}
                </Field>
                <Field
                  label="GSTIN"
                  required={type === "B2B"}
                  error={errors.gstin?.message}
                  helper={type === "B2B" ? "Required for business customers." : "Only for registered businesses."}
                >
                  {(p) => (
                    <Input
                      {...p}
                      className="uppercase"
                      maxLength={15}
                      placeholder="32AAAAA0000A1Z5"
                      {...register("gstin")}
                    />
                  )}
                </Field>
                <Field
                  label="State (place of supply)"
                  error={errors.stateCode?.message}
                  helper="Leave as branch state for local customers."
                >
                  {(p) => (
                    <Select {...p} {...register("stateCode")}>
                      <option value="">Same as branch</option>
                      {INDIAN_STATES.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.code} · {s.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </FormGrid>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Dues (pay later)" subtitle="Set 0 if this customer must always pay the full bill." />
            <CardBody className="space-y-4">
              <Field label="Maximum dues allowed" error={errors.creditLimit?.message}>
                {(p) => (
                  <Input
                    {...p}
                    type="number"
                    min={0}
                    step="0.01"
                    align="right"
                    suffix="₹"
                    {...register("creditLimit")}
                  />
                )}
              </Field>
              <Field
                label="Days to clear dues"
                error={errors.creditDays?.message}
                helper="Bills show as overdue if dues are not paid within these days."
              >
                {(p) => (
                  <Input
                    {...p}
                    type="number"
                    min={0}
                    max={365}
                    align="right"
                    suffix="days"
                    {...register("creditDays")}
                  />
                )}
              </Field>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Notes" />
            <CardBody>
              <Field label="Internal notes" error={errors.notes?.message}>
                {(p) => <Textarea {...p} rows={4} {...register("notes")} />}
              </Field>
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3 border-t border-border pt-5">
        <Button variant="ghost" onClick={() => navigate(editing ? `/customers/${id}` : "/customers")}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending} loadingText="Saving…" disabled={editing && !isDirty}>
          {editing ? "Save changes" : "Save customer"}
        </Button>
      </div>
    </form>
  );
}
