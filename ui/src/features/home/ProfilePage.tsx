import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { formatMobile, optionalMobileSchema, passwordSchema } from "@automobile/shared";
import { meKey, useAuth } from "@/app/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DescriptionList, PageHeader } from "@/components/ui/Controls";
import { Field, FormGrid, Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api-client";
import { applyServerErrors, formatDateTime } from "@/lib/utils";

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "Required").max(100),
  lastName: z.string().trim().min(1, "Required").max(100),
  phone: optionalMobileSchema,
});

const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

export function ProfilePage() {
  const { me, logout } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  const profile = useForm<z.input<typeof profileSchema>>({ resolver: zodResolver(profileSchema) });
  const password = useForm<z.input<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });

  useEffect(() => {
    if (me)
      profile.reset({
        firstName: me.user.firstName,
        lastName: me.user.lastName,
        phone: me.user.phone ? formatMobile(me.user.phone) : "",
      });
  }, [me, profile]);

  const saveProfile = useMutation({
    mutationFn: (body: unknown) => api.patch("/users/me", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: meKey }),
  });
  const changePassword = useMutation({ mutationFn: (body: unknown) => api.patch("/users/me/password", body) });

  if (!me) return null;

  const onProfile = profile.handleSubmit(async (values) => {
    try {
      await saveProfile.mutateAsync(values);
      toast({ message: "Profile saved" });
    } catch (err) {
      const message = applyServerErrors(err, profile.setError);
      if (message) toast({ message, tone: "error" });
    }
  });

  const onPassword = password.handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      toast({ message: "Password changed. Sign in again with the new password." });
      await logout();
    } catch (err) {
      const message = applyServerErrors(err, password.setError);
      if (message) toast({ message, tone: "error" });
    }
  });

  return (
    <>
      <PageHeader title="My profile" description={me.user.email} />
      <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={onProfile} noValidate>
          <Card>
            <CardHeader
              title="Details"
              actions={
                <Button size="sm" type="submit" loading={saveProfile.isPending} disabled={!profile.formState.isDirty}>
                  Save
                </Button>
              }
            />
            <CardBody className="space-y-6">
              <FormGrid>
                <Field label="First name" required error={profile.formState.errors.firstName?.message}>
                  {(p) => <Input {...p} {...profile.register("firstName")} />}
                </Field>
                <Field label="Last name" required error={profile.formState.errors.lastName?.message}>
                  {(p) => <Input {...p} {...profile.register("lastName")} />}
                </Field>
                <Field label="Mobile" error={profile.formState.errors.phone?.message}>
                  {(p) => <Input {...p} inputMode="tel" {...profile.register("phone")} />}
                </Field>
              </FormGrid>
              <DescriptionList
                items={[
                  { label: "Role", value: me.user.role.name },
                  {
                    label: "Branches",
                    value: me.isOwner ? "All branches" : me.user.branches.map((b) => b.name).join(", "),
                  },
                  { label: "Last sign-in", value: formatDateTime(me.user.lastLoginAt) },
                ]}
              />
            </CardBody>
          </Card>
        </form>

        <form onSubmit={onPassword} noValidate>
          <Card>
            <CardHeader title="Change password" subtitle="You'll be signed out on every device." />
            <CardBody className="space-y-4">
              <Field label="Current password" error={password.formState.errors.currentPassword?.message}>
                {(p) => (
                  <Input
                    {...p}
                    type="password"
                    autoComplete="current-password"
                    {...password.register("currentPassword")}
                  />
                )}
              </Field>
              <Field
                label="New password"
                error={password.formState.errors.newPassword?.message}
                helper="At least 8 characters."
              >
                {(p) => (
                  <Input {...p} type="password" autoComplete="new-password" {...password.register("newPassword")} />
                )}
              </Field>
              <Field label="Confirm new password" error={password.formState.errors.confirm?.message}>
                {(p) => <Input {...p} type="password" autoComplete="new-password" {...password.register("confirm")} />}
              </Field>
              <div className="flex justify-end">
                <Button type="submit" loading={changePassword.isPending} loadingText="Changing…">
                  Change password
                </Button>
              </div>
            </CardBody>
          </Card>
        </form>
      </div>
    </>
  );
}
