import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate } from "react-router";
import type { z } from "zod";
import { checkGstin, INDIAN_STATES, registerSchema } from "@erp-software/shared";
import { useAuth } from "@/app/auth";
import { Button } from "@/components/ui/Button";
import { Field, FormGrid, Input, PasswordInput, Select } from "@/components/ui/Field";
import { ErrorBanner } from "@/components/ui/States";
import { api } from "@/lib/api-client";
import { applyServerErrors } from "@/lib/utils";
import { AuthLayout, SuccessBox } from "./AuthLayout";

type RegisterForm = z.input<typeof registerSchema>;

// Self-service sign-up for a new shop. The shop starts "waiting for approval"; the owner can log in
// after the platform admin approves it.
export function RegisterPage() {
  const { status } = useAuth();
  const [done, setDone] = useState<{ email: string; message: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      shopName: "",
      city: "",
      stateCode: "",
      gstin: "",
      ownerFirstName: "",
      ownerLastName: "",
      mobile: "",
      email: "",
      password: "",
    },
  });

  // A valid GSTIN tells us the state.
  const gstin = watch("gstin");
  useEffect(() => {
    const check = gstin ? checkGstin(gstin) : null;
    if (check?.valid) setValue("stateCode", check.stateCode, { shouldValidate: true });
  }, [gstin, setValue]);

  if (status === "signed-in") return <Navigate to="/" replace />;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const res = await api.postWithMessage<{ status: string }>("/auth/register", values);
      setDone({ email: values.email, message: res.message ?? "Your business is waiting for approval." });
    } catch (err) {
      setFormError(applyServerErrors(err, setError));
    }
  });

  if (done) {
    return (
      <AuthLayout title="Registration received">
        <SuccessBox title={done.message}>
          We sent an email to <strong>{done.email}</strong>. Please click the link in it to confirm your email address.
          You can log in with your mobile number as soon as your business is approved.
        </SuccessBox>
        <Link to="/login" className="mt-5 inline-block font-medium text-navy-600 hover:underline">
          Back to log in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      wide
      title="Register your business"
      subtitle="Free to start. We check every new business and approve it, usually within a day."
      footer={
        <>
          Already registered?{" "}
          <Link to="/login" className="font-medium text-navy-600 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        {formError && <ErrorBanner className="mt-4" title={formError} />}

        <h3 className="mt-6 mb-3 eyebrow text-slate">Your business</h3>
        <FormGrid>
          <Field label="Business name" required error={errors.shopName?.message} className="sm:col-span-2">
            {(p) => <Input {...p} autoFocus autoComplete="organization" {...register("shopName")} />}
          </Field>
          <Field label="City" required error={errors.city?.message}>
            {(p) => <Input {...p} autoComplete="address-level2" {...register("city")} />}
          </Field>
          <Field label="State" required error={errors.stateCode?.message}>
            {(p) => (
              <Select {...p} {...register("stateCode")}>
                <option value="">Choose a state</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="GSTIN" helper="Optional. You can add it later." error={errors.gstin?.message}>
            {(p) => <Input {...p} className="uppercase" maxLength={15} {...register("gstin")} />}
          </Field>
        </FormGrid>

        <h3 className="mt-7 mb-3 eyebrow text-slate">Owner login</h3>
        <FormGrid>
          <Field label="First name" required error={errors.ownerFirstName?.message}>
            {(p) => <Input {...p} autoComplete="given-name" {...register("ownerFirstName")} />}
          </Field>
          <Field label="Last name" required error={errors.ownerLastName?.message}>
            {(p) => <Input {...p} autoComplete="family-name" {...register("ownerLastName")} />}
          </Field>
          <Field
            label="Mobile number"
            required
            helper="You will log in with this number."
            error={errors.mobile?.message}
          >
            {(p) => <Input {...p} inputMode="tel" autoComplete="tel" maxLength={14} {...register("mobile")} />}
          </Field>
          <Field
            label="Email"
            required
            helper="For approval news and password reset links."
            error={errors.email?.message}
          >
            {(p) => <Input {...p} type="email" autoComplete="email" {...register("email")} />}
          </Field>
          <Field label="Password" required helper="At least 8 characters." error={errors.password?.message}>
            {(p) => <PasswordInput {...p} autoComplete="new-password" {...register("password")} />}
          </Field>
        </FormGrid>

        <Button type="submit" className="mt-6 w-full" loading={isSubmitting} loadingText="Registering…">
          Register business
        </Button>
      </form>
    </AuthLayout>
  );
}
