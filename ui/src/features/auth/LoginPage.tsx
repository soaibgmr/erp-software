import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate, useLocation } from "react-router";
import { loginSchema } from "@automobile/shared";
import type { z } from "zod";
import { useAuth } from "@/app/auth";
import { Logo } from "@/app/AppShell";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { ErrorBanner } from "@/components/ui/States";
import { ApiError } from "@/lib/api-client";

type LoginForm = z.input<typeof loginSchema>;

export function LoginPage() {
  const { status, login } = useAuth();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  if (status === "signed-in") {
    const from = (location.state as { from?: string } | null)?.from ?? "/";
    return <Navigate to={from} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values.email, values.password);
    } catch (err) {
      setFormError(
        err instanceof ApiError && err.status === 401
          ? "Email or password is incorrect."
          : err instanceof Error
            ? err.message
            : "Couldn't sign in.",
      );
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex items-center gap-3">
          <Logo className="size-11" />
          <div>
            <p className="eyebrow text-slate">Workshop & parts ERP</p>
            <h1 className="text-page font-bold tracking-[-0.01em] text-ink">Automobile.In</h1>
          </div>
        </div>
        <form onSubmit={onSubmit} noValidate className="rounded-card border border-border bg-surface p-6">
          <h2 className="text-section font-semibold text-ink">Sign in</h2>
          <p className="mt-1 text-helper text-slate">Use the account your owner or manager created for you.</p>
          {formError && <ErrorBanner className="mt-4" title={formError} />}
          <div className="mt-5 space-y-4">
            <Field label="Email" error={errors.email?.message}>
              {(p) => <Input {...p} type="email" autoComplete="username" autoFocus {...register("email")} />}
            </Field>
            <Field label="Password" error={errors.password?.message}>
              {(p) => <Input {...p} type="password" autoComplete="current-password" {...register("password")} />}
            </Field>
          </div>
          <Button type="submit" className="mt-6 w-full" loading={isSubmitting} loadingText="Signing in…">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
