import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShieldCheck } from "lucide-react";
import { passwordSchema } from "@erp-software/shared";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DescriptionList, PageHeader } from "@/components/ui/Controls";
import { Field, PasswordInput } from "@/components/ui/Field";
import { ErrorBanner } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { applyServerErrors, formatDateTime } from "@/lib/utils";
import { useChangePlatformPassword, usePlatformMe, usePlatformToken } from "./api";

const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Passwords don't match" })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Choose a password different from the current one",
  });

// The platform admin's own account: who is signed in, and changing the password.
export function PlatformAccountPage() {
  const { token } = usePlatformToken();
  const me = usePlatformMe(token).data;
  const change = useChangePlatformPassword(token);
  const toast = useToast();
  const form = useForm<z.input<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await change.mutateAsync({ currentPassword, newPassword });
      form.reset();
      toast({ message: "Password changed. Other devices are signed out." });
    } catch (err) {
      const message = applyServerErrors(err, form.setError);
      if (message) form.setError("root", { message });
    }
  });

  return (
    <div>
      <PageHeader title="Account" description="Your platform admin login." />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader title="Your account" />
          <CardBody>
            <DescriptionList
              items={[
                { label: "Name", value: me?.name },
                { label: "Email", value: me?.email },
                { label: "Last login", value: formatDateTime(me?.lastLoginAt) },
                {
                  label: "Password last changed",
                  value: me?.passwordChangedAt ? formatDateTime(me.passwordChangedAt) : "Never",
                },
              ]}
            />
          </CardBody>
        </Card>

        <form onSubmit={onSubmit} noValidate>
          <Card>
            <CardHeader
              title="Change password"
              subtitle="Every other device signed in as you is logged out. This one stays signed in."
            />
            <CardBody className="space-y-4">
              {errors.root?.message && <ErrorBanner title={errors.root.message} />}
              <Field label="Current password" error={errors.currentPassword?.message}>
                {(p) => <PasswordInput {...p} autoComplete="current-password" {...form.register("currentPassword")} />}
              </Field>
              <Field
                label="New password"
                error={errors.newPassword?.message}
                helper="At least 8 characters; 12 or more is safer."
              >
                {(p) => <PasswordInput {...p} autoComplete="new-password" {...form.register("newPassword")} />}
              </Field>
              <Field label="Confirm new password" error={errors.confirm?.message}>
                {(p) => <PasswordInput {...p} autoComplete="new-password" {...form.register("confirm")} />}
              </Field>
              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="flex items-center gap-1.5 text-helper text-slate">
                  <ShieldCheck className="size-4 text-success" />
                  Locked for 15 minutes after 8 wrong tries.
                </p>
                <Button type="submit" loading={change.isPending} loadingText="Changing…">
                  Change password
                </Button>
              </div>
            </CardBody>
          </Card>
        </form>
      </div>
    </div>
  );
}
