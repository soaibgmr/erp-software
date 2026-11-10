import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { loginSchema } from "@erp-software/shared";
import type { z } from "zod";
import { useAuth } from "@/app/auth";
import { Button } from "@/components/ui/Button";
import { Field, Input, PasswordInput } from "@/components/ui/Field";
import { ErrorBanner } from "@/components/ui/States";
import { ApiError } from "@/lib/api-client";
import { platformLogin } from "@/features/platform/api";
import { AuthLayout } from "./AuthLayout";

type LoginForm = z.input<typeof loginSchema>;

export function LoginPage() {
  const { status, login, notice } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<{ title: string; message?: string } | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { identifier: "", password: "" } });

  if (status === "signed-in") {
    const from = (location.state as { from?: string } | null)?.from ?? "/";
    return <Navigate to={from} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values.identifier, values.password);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // One login page for everyone: an email that isn't a shop account may be the platform admin.
        if (values.identifier.includes("@")) {
          try {
            await platformLogin(values.identifier, values.password);
            navigate("/admin/shops", { replace: true });
            return;
          } catch {
            // Not an admin either: show the normal message below.
          }
        }
        setFormError({ title: "Username or password is incorrect." });
      } else if (err instanceof ApiError && err.code === "BUSINESS_PENDING") {
        setFormError({ title: "Your shop is waiting for approval", message: err.message });
      } else if (err instanceof ApiError && err.code.startsWith("BUSINESS_")) {
        setFormError({ title: "You can't log in right now", message: err.message });
      } else {
        setFormError({ title: err instanceof Error ? err.message : "Couldn't log in." });
      }
    }
  });

  const shown = formError ?? (notice ? { title: "You were logged out", message: notice } : null);

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to your business to start billing."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>New to ERP Software?</span>
          <Link
            to="/register"
            className="inline-flex h-10 items-center rounded-input border border-border px-4 font-medium text-navy-700 hover:bg-navy-50"
          >
            Register your business
          </Link>
        </div>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        {shown && <ErrorBanner className="mt-6" title={shown.title} message={shown.message} />}
        <div className="mt-8 space-y-5">
          <Field label="Username" helper="Your mobile number or email" error={errors.identifier?.message}>
            {(p) => (
              <Input
                {...p}
                className="h-11"
                placeholder="98765 43210 or you@shop.in"
                autoComplete="username"
                autoFocus
                {...register("identifier")}
              />
            )}
          </Field>
          <div>
            <Field label="Password" error={errors.password?.message}>
              {(p) => (
                <PasswordInput {...p} className="h-11" autoComplete="current-password" {...register("password")} />
              )}
            </Field>
            <div className="mt-2 text-right">
              <Link to="/forgot-password" className="text-helper font-medium text-navy-600 hover:underline">
                Forgot password?
              </Link>
            </div>
          </div>
        </div>
        <Button type="submit" size="lg" className="mt-6 w-full" loading={isSubmitting} loadingText="Logging in…">
          Log in
        </Button>
      </form>
    </AuthLayout>
  );
}
