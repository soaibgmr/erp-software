import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useSearchParams } from "react-router";
import { z } from "zod";
import { forgotPasswordSchema, passwordSchema } from "@erp-software/shared";
import { Button } from "@/components/ui/Button";
import { Field, Input, PasswordInput } from "@/components/ui/Field";
import { ErrorBanner } from "@/components/ui/States";
import { api } from "@/lib/api-client";
import { applyServerErrors, errorMessage } from "@/lib/utils";
import { AuthLayout, SuccessBox } from "./AuthLayout";

const backToLogin = (
  <Link to="/login" className="font-medium text-navy-600 hover:underline">
    Back to log in
  </Link>
);

export function ForgotPasswordPage() {
  const [sent, setSent] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { identifier: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const res = await api.postWithMessage("/auth/forgot-password", values);
      setSent(res.message ?? "If this account has an email address, we have sent a reset link.");
    } catch (err) {
      setFormError(applyServerErrors(err, setError));
    }
  });

  return (
    <AuthLayout
      title="Forgot password"
      subtitle="We'll email you a link to choose a new password."
      footer={backToLogin}
    >
      {sent ? (
        <SuccessBox title="Check your email">
          {sent} The link works for 30 minutes. Staff without an email: ask your shop owner to set a new password from
          Settings → Users.
        </SuccessBox>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          {formError && <ErrorBanner className="mt-4" title={formError} />}
          <Field label="Mobile number or email" className="mt-5" error={errors.identifier?.message}>
            {(p) => <Input {...p} autoFocus autoComplete="username" {...register("identifier")} />}
          </Field>
          <Button type="submit" className="mt-5 w-full" loading={isSubmitting} loadingText="Sending…">
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

const resetForm = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords don't match" });

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof resetForm>>({
    resolver: zodResolver(resetForm),
    defaultValues: { password: "", confirm: "" },
  });

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null);
    try {
      await api.post("/auth/reset-password", { token, password }, { auth: false });
      setDone(true);
    } catch (err) {
      setFormError(applyServerErrors(err, setError));
    }
  });

  if (!token) {
    return (
      <AuthLayout title="Reset password" footer={backToLogin}>
        <ErrorBanner className="mt-4" title="This link is incomplete" message="Open the link from the email again." />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password" footer={done ? undefined : backToLogin}>
      {done ? (
        <>
          <SuccessBox title="Password changed">You can log in with your new password now.</SuccessBox>
          <Link to="/login" className="mt-5 inline-block font-medium text-navy-600 hover:underline">
            Log in
          </Link>
        </>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          {formError && (
            <ErrorBanner
              className="mt-4"
              title={formError}
              extra={
                <Link to="/forgot-password" className="text-helper font-medium text-navy-600 hover:underline">
                  Get a new link
                </Link>
              }
            />
          )}
          <div className="mt-5 space-y-4">
            <Field label="New password" helper="At least 8 characters." error={errors.password?.message}>
              {(p) => <PasswordInput {...p} autoFocus autoComplete="new-password" {...register("password")} />}
            </Field>
            <Field label="Type it again" error={errors.confirm?.message}>
              {(p) => <PasswordInput {...p} autoComplete="new-password" {...register("confirm")} />}
            </Field>
          </div>
          <Button type="submit" className="mt-5 w-full" loading={isSubmitting} loadingText="Saving…">
            Save new password
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

// Opened from the sign-up email; confirms the address on load.
export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<{ status: "working" | "done" | "error"; message?: string }>({
    status: token ? "working" : "error",
    message: token ? undefined : "This link is incomplete. Open the link from the email again.",
  });
  const started = useRef(false);

  useEffect(() => {
    // Once only, even under React's double effects in development (a token works one time).
    if (!token || started.current) return;
    started.current = true;
    api
      .post("/auth/verify-email", { token }, { auth: false })
      .then(() => setState({ status: "done" }))
      .catch((err: unknown) => setState({ status: "error", message: errorMessage(err) }));
  }, [token]);

  return (
    <AuthLayout title="Confirm email" footer={backToLogin}>
      {state.status === "working" && <p className="mt-4 text-body text-slate">Confirming…</p>}
      {state.status === "done" && (
        <SuccessBox title="Email confirmed">
          Thank you. If your shop is still waiting for approval, we'll email you as soon as it is active.
        </SuccessBox>
      )}
      {state.status === "error" && (
        <ErrorBanner className="mt-4" title="We couldn't confirm this email" message={state.message} />
      )}
    </AuthLayout>
  );
}
