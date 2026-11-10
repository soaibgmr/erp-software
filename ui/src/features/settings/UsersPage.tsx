import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Search, UserRound } from "lucide-react";
import type { z } from "zod";
import {
  formatMobile,
  passwordSchema,
  USER_STATUSES,
  userCreateSchema,
  userUpdateSchema,
  type UserStatus,
} from "@erp-software/shared";
import { useAuth } from "@/app/auth";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Checkbox, Field, FormGrid, Input, Select } from "@/components/ui/Field";
import { Menu } from "@/components/ui/Menu";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { EmptyState, NoResults } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useDebounced } from "@/lib/hooks";
import type { User } from "@/lib/types";
import { applyServerErrors, errorMessage, formatDateTime, initials } from "@/lib/utils";
import { useBranches, useDeleteUser, useRoles, useSaveUser, useSetUserPassword } from "./api";
import { useUsers } from "./api";

const statusTone: Record<UserStatus, Tone> = { ACTIVE: "success", INACTIVE: "neutral", SUSPENDED: "danger" };
const statusLabel: Record<UserStatus, string> = { ACTIVE: "Active", INACTIVE: "Inactive", SUSPENDED: "Suspended" };

type FormInput = z.input<typeof userCreateSchema>;

export function UsersPage() {
  const { me } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleId, setRoleId] = useState("");
  const debounced = useDebounced(search.trim());
  const query = useUsers({ page, search: debounced || undefined, roleId: roleId || undefined });
  const roles = useRoles();
  const save = useSaveUser();
  const remove = useDeleteUser();
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);

  const setStatus = async (u: User, status: UserStatus) => {
    try {
      await save.mutateAsync({ id: u.id, body: { status } });
      toast({ message: `${u.firstName} is now ${statusLabel[status].toLowerCase()}` });
    } catch (err) {
      toast({ message: errorMessage(err), tone: "error" });
    }
  };

  const columns: Column<User>[] = [
    {
      key: "name",
      header: "User",
      cell: (u) => (
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy-50 text-overline font-semibold text-navy-700">
            {initials(u.firstName, u.lastName)}
          </span>
          <div className="min-w-0">
            <p className="font-medium text-ink">
              {u.firstName} {u.lastName}
              {u.id === me?.user.id && <span className="ml-1.5 text-helper text-slate">(you)</span>}
            </p>
            <p className="truncate text-helper text-slate">
              {[u.mobile && formatMobile(u.mobile), u.email].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
        </div>
      ),
    },
    { key: "role", header: "Role", cell: (u) => u.role.name },
    {
      key: "branches",
      header: "Branches",
      cell: (u) =>
        u.role.key === "OWNER" ? (
          <span className="text-slate">All branches</span>
        ) : (
          u.branches.map((b) => b.name).join(", ") || "—"
        ),
    },
    {
      key: "status",
      header: "Status",
      cell: (u) => <Badge tone={statusTone[u.status]}>{statusLabel[u.status]}</Badge>,
    },
    {
      key: "login",
      header: "Last login",
      cell: (u) => <span className="text-slate">{formatDateTime(u.lastLoginAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (u) =>
        u.id === me?.user.id ? null : (
          <Menu
            items={[
              { label: "Edit", onSelect: () => setEditing(u) },
              { label: "Set new password", onSelect: () => setResetting(u) },
              u.status === "ACTIVE"
                ? { label: "Deactivate", onSelect: () => void setStatus(u, "INACTIVE") }
                : { label: "Activate", onSelect: () => void setStatus(u, "ACTIVE") },
              { label: "Delete user", destructive: true, onSelect: () => setDeleting(u) },
            ]}
          />
        ),
    },
  ];

  return (
    <Card>
      <CardHeader
        title="Users"
        subtitle="Everyone who signs in. Their role decides what they see; branches decide where."
        actions={
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
            New user
          </Button>
        }
      />
      <div className="flex flex-wrap gap-3 border-b border-border p-4">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate" />
          <Input
            aria-label="Search users"
            placeholder="Search name, mobile or email"
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          aria-label="Role"
          className="w-52"
          value={roleId}
          onChange={(e) => {
            setRoleId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All roles</option>
          {roles.data?.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      </div>
      <DataTable
        columns={columns}
        rows={query.data?.data}
        rowKey={(u) => u.id}
        loading={query.isPending}
        error={query.error}
        onRetry={() => query.refetch()}
        empty={
          debounced || roleId ? (
            <NoResults
              query={debounced || undefined}
              onClear={() => {
                setSearch("");
                setRoleId("");
              }}
            />
          ) : (
            <EmptyState icon={UserRound} title="No users yet" />
          )
        }
      />
      <Pagination meta={query.data?.meta} onPage={setPage} />

      <UserForm
        user={editing}
        saving={save.isPending}
        onClose={() => setEditing(null)}
        onSave={async (values, setError) => {
          try {
            const u = await save.mutateAsync({ id: editing === "new" ? undefined : editing?.id, body: values });
            toast({ message: editing === "new" ? `${u.firstName} can now sign in` : `${u.firstName} saved` });
            setEditing(null);
          } catch (err) {
            const message = applyServerErrors(err, setError);
            if (message) toast({ message, tone: "error" });
          }
        }}
      />

      {resetting && <SetPasswordDialog user={resetting} onClose={() => setResetting(null)} />}

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.firstName} ${deleting?.lastName}?`}
        body="They are signed out everywhere and can't sign in again. Their past work keeps their name. This can't be undone."
        cancelLabel="Keep user"
        confirmLabel="Delete user"
        loading={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(deleting!.id);
            toast({ message: `${deleting!.firstName} deleted` });
          } catch (err) {
            toast({ message: errorMessage(err), tone: "error" });
          }
          setDeleting(null);
        }}
      />
    </Card>
  );
}

function UserForm({
  user,
  saving,
  onClose,
  onSave,
}: {
  user: User | "new" | null;
  saving: boolean;
  onClose: () => void;
  onSave: (values: unknown, setError: ReturnType<typeof useForm<FormInput>>["setError"]) => Promise<void>;
}) {
  const { me } = useAuth();
  const isNew = user === "new";
  const roles = useRoles(Boolean(user));
  const branches = useBranches(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors },
  } = useForm<FormInput>({
    // Editing never sends the password: that field isn't rendered, so it isn't in the values.
    resolver: zodResolver((isNew ? userCreateSchema : userUpdateSchema) as typeof userCreateSchema),
  });

  useEffect(() => {
    if (user === "new") {
      reset({
        firstName: "",
        lastName: "",
        mobile: "",
        email: "",
        password: "",
        roleId: "",
        branchIds: [],
        status: "ACTIVE",
      });
    } else if (user) {
      reset({
        firstName: user.firstName,
        lastName: user.lastName,
        mobile: user.mobile ?? "",
        email: user.email ?? "",
        roleId: user.role.id,
        branchIds: user.branches.map((b) => b.id),
        status: user.status,
      } as FormInput);
    }
  }, [user, reset]);

  const roleId = watch("roleId");
  const selectedRole = roles.data?.find((r) => r.id === roleId);
  const availableRoles = roles.data?.filter((r) => r.key !== "OWNER" || me?.isOwner) ?? [];
  const submit = handleSubmit((values) => onSave(values, setError));

  return (
    <Modal
      open={Boolean(user)}
      onClose={onClose}
      size="md"
      title={isNew ? "New user" : `Edit ${user && user.firstName}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} loadingText="Saving…">
            {isNew ? "Create user" : "Save user"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <FormGrid>
          <Field label="First name" required error={errors.firstName?.message}>
            {(p) => <Input {...p} {...register("firstName")} />}
          </Field>
          <Field label="Last name" required error={errors.lastName?.message}>
            {(p) => <Input {...p} {...register("lastName")} />}
          </Field>
          <Field label="Mobile number" required error={errors.mobile?.message} helper="Used to log in.">
            {(p) => <Input {...p} inputMode="tel" autoComplete="off" {...register("mobile")} />}
          </Field>
          <Field label="Email" error={errors.email?.message} helper="Optional. Lets them reset their own password.">
            {(p) => <Input {...p} type="email" autoComplete="off" {...register("email")} />}
          </Field>
          {isNew && (
            <Field
              label="Temporary password"
              required
              error={errors.password?.message}
              helper="At least 8 characters. Share it privately."
            >
              {(p) => <Input {...p} type="text" autoComplete="new-password" {...register("password")} />}
            </Field>
          )}
          <Field label="Status" error={errors.status?.message}>
            {(p) => (
              <Select {...p} {...register("status")}>
                {USER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            label="Role"
            required
            error={errors.roleId?.message}
            helper={selectedRole?.description ?? undefined}
            className="sm:col-span-2"
          >
            {(p) => (
              <Select {...p} {...register("roleId")}>
                <option value="">Choose a role</option>
                {availableRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </FormGrid>

        {selectedRole?.key !== "OWNER" && (
          <fieldset className="mt-5">
            <legend className="text-body font-medium text-ink">
              Branches <span className="text-danger">*</span>
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {branches.data?.map((b) => (
                <Checkbox
                  key={b.id}
                  value={b.id}
                  label={b.name}
                  description={b.city ?? undefined}
                  {...register("branchIds")}
                />
              ))}
            </div>
            {errors.branchIds && (
              <p className="mt-1.5 text-helper text-danger">
                {errors.branchIds.message ?? "Choose at least one branch"}
              </p>
            )}
          </fieldset>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

// For staff who forgot their password and have no email: the owner or manager sets a temporary one.
function SetPasswordDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const setPassword = useSetUserPassword();
  const toast = useToast();
  const [password, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const check = passwordSchema.safeParse(password);
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? "At least 8 characters");
      return;
    }
    try {
      await setPassword.mutateAsync({ id: user.id, password });
      toast({ message: `New password set for ${user.firstName}` });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Set a new password for ${user.firstName}?`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={setPassword.isPending} loadingText="Saving…">
            Set password
          </Button>
        </>
      }
    >
      <p className="text-body text-slate">
        They are logged out on every device and log in again with this password. Share it privately.
      </p>
      <form
        className="mt-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Temporary password" required error={error ?? undefined} helper="At least 8 characters.">
          {(p) => (
            <Input
              {...p}
              autoFocus
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}
