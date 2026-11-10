import { useMemo, useState } from "react";
import { Lock, Plus, ShieldCheck } from "lucide-react";
import type { Permission } from "@erp-software/shared";
import { useAuth } from "@/app/auth";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Checkbox, Field, Input } from "@/components/ui/Field";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorBanner, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api-client";
import type { Role } from "@/lib/types";
import { cn, errorMessage } from "@/lib/utils";
import { useDeleteRole, usePermissionGroups, useRoles, useSaveRole } from "./api";

export function RolesPage() {
  const roles = useRoles();
  const groups = usePermissionGroups();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const selected = roles.data?.find((r) => r.id === selectedId) ?? roles.data?.[0];

  if (roles.error)
    return (
      <ErrorBanner title="Couldn't load roles" message={errorMessage(roles.error)} onRetry={() => roles.refetch()} />
    );

  return (
    <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardHeader
          title="Roles"
          actions={
            <Button size="sm" variant="outline" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
              New
            </Button>
          }
        />
        <ul className="p-2">
          {roles.isPending &&
            Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="px-3 py-3">
                <Skeleton className="h-3.5 w-32" />
              </li>
            ))}
          {roles.data?.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelectedId(r.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-input px-3 py-2.5 text-left",
                  selected?.id === r.id ? "bg-navy-50" : "hover:bg-navy-50/60",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-body font-medium text-ink">{r.name}</span>
                  <span className="text-helper text-slate">
                    {r.userCount} user{r.userCount === 1 ? "" : "s"}
                  </span>
                </span>
                {r.isSystem && <Badge dot={false}>System</Badge>}
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {selected && groups.data ? (
        // Keyed on the saved permissions too, so the editor resets when the role changes on the server.
        <RoleEditor
          key={`${selected.id}:${selected.permissions.join(",")}`}
          role={selected}
          groups={groups.data}
          onDeleted={() => setSelectedId(null)}
        />
      ) : (
        <Skeleton className="h-[520px] w-full rounded-card" />
      )}

      <NewRoleModal open={creating} onClose={() => setCreating(false)} onCreated={(r) => setSelectedId(r.id)} />
    </div>
  );
}

function RoleEditor({
  role,
  groups,
  onDeleted,
}: {
  role: Role;
  groups: NonNullable<ReturnType<typeof usePermissionGroups>["data"]>;
  onDeleted: () => void;
}) {
  const { me } = useAuth();
  const toast = useToast();
  const save = useSaveRole();
  const remove = useDeleteRole();
  const [perms, setPerms] = useState<Set<Permission>>(() => new Set(role.permissions));
  const [confirming, setConfirming] = useState(false);
  const locked = role.key === "OWNER";

  const dirty = useMemo(
    () => perms.size !== role.permissions.length || role.permissions.some((p) => !perms.has(p)),
    [perms, role.permissions],
  );
  // Non-owners can't grant what they don't have; those boxes are disabled.
  const canGrant = (p: Permission) => me?.isOwner || me?.permissions.includes(p);

  const toggle = (p: Permission) =>
    setPerms((s) => {
      const next = new Set(s);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });

  const onSave = async () => {
    try {
      await save.mutateAsync({ id: role.id, body: { permissions: [...perms] } });
      toast({ message: `${role.name} saved` });
    } catch (err) {
      toast({ message: errorMessage(err), tone: "error" });
    }
  };

  return (
    <Card>
      <CardHeader
        title={role.name}
        subtitle={role.description ?? undefined}
        actions={
          !locked && (
            <>
              {!role.isSystem && (
                <Button size="sm" variant="danger-outline" onClick={() => setConfirming(true)}>
                  Delete
                </Button>
              )}
              <Button size="sm" onClick={onSave} disabled={!dirty} loading={save.isPending} loadingText="Saving…">
                Save permissions
              </Button>
            </>
          )
        }
      />
      {locked ? (
        <EmptyState
          icon={Lock}
          title="Owners can do everything"
          description="The Owner role passes every permission and branch check, so it can't be edited."
        />
      ) : (
        <CardBody className="grid gap-6 md:grid-cols-2">
          {groups.map((g) => (
            <fieldset key={g.group}>
              <legend className="eyebrow mb-3 text-slate">{g.group}</legend>
              <div className="space-y-2.5">
                {g.permissions.map((p) => (
                  <Checkbox
                    key={p.code}
                    checked={perms.has(p.code)}
                    disabled={!canGrant(p.code)}
                    onChange={() => toggle(p.code)}
                    label={p.label}
                    description={<code className="text-overline">{p.code}</code>}
                  />
                ))}
              </div>
            </fieldset>
          ))}
        </CardBody>
      )}

      <ConfirmDialog
        open={confirming}
        title={`Delete the ${role.name} role?`}
        body={
          role.userCount
            ? `${role.userCount} user(s) still have this role. Move them to another role first.`
            : "This can't be undone."
        }
        cancelLabel="Keep role"
        confirmLabel="Delete role"
        loading={remove.isPending}
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(role.id);
            toast({ message: `${role.name} deleted` });
            onDeleted();
          } catch (err) {
            toast({ message: errorMessage(err), tone: "error" });
          }
          setConfirming(false);
        }}
      />
    </Card>
  );
}

// Mounted only while open, so each time starts with empty fields.
function NewRoleModal({ open, ...props }: { open: boolean; onClose: () => void; onCreated: (r: Role) => void }) {
  return open ? <NewRoleForm {...props} /> : null;
}

function NewRoleForm({ onClose, onCreated }: { onClose: () => void; onCreated: (r: Role) => void }) {
  const open = true;
  const save = useSaveRole();
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string>();

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    try {
      const role = await save.mutateAsync({ body: { name, description, permissions: [] } });
      toast({ message: `${role.name} created. Choose its permissions.` });
      onCreated(role);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? (err.fieldErrors.name ?? err.message) : errorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New role"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={<ShieldCheck className="size-4" />} onClick={() => void submit()} loading={save.isPending}>
            Create role
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Role name" required error={error}>
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Washer" />}
        </Field>
        <Field label="Description">
          {(p) => <Input {...p} value={description} onChange={(e) => setDescription(e.target.value)} />}
        </Field>
      </form>
    </Modal>
  );
}
