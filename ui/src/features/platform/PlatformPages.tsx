import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router";
import { Loader2, LogOut, Search, Store } from "lucide-react";
import { BUSINESS_STATUS_LABELS, formatMobile, INDIAN_STATES, type BusinessStatus } from "@erp-software/shared";
import { Logo } from "@/app/AppShell";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/Controls";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorBanner } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { PlatformBusiness } from "@/lib/types";
import { errorMessage, formatDate } from "@/lib/utils";
import { usePlatformMe, usePlatformShops, usePlatformToken, useUpdateShopStatus } from "./api";

// ---- Shell: signed-in admin only ----

export function PlatformShell() {
  const { token, signOut } = usePlatformToken();
  const me = usePlatformMe(token);

  // Expired or revoked token: forget it and go back to the login page.
  useEffect(() => {
    if (me.error) signOut();
  }, [me.error, signOut]);

  // Everyone signs in on the one login page (/login), which also recognises the platform admin.
  if (!token || me.error) return <Navigate to="/login" replace />;
  if (!me.data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate" role="status">
        <Loader2 className="size-6 animate-spin" aria-label="Loading" />
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4">
          <Logo className="size-8" />
          <p className="font-semibold text-ink">Platform admin</p>
          <span className="ml-auto hidden text-helper text-slate sm:inline">{me.data.email}</span>
          <Button size="sm" variant="ghost" icon={<LogOut className="size-4" />} onClick={signOut}>
            Log out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

// ---- Shops ----

const STATUS_TONE: Record<BusinessStatus, Tone> = {
  PENDING: "warning",
  ACTIVE: "success",
  SUSPENDED: "danger",
  REJECTED: "neutral",
};

type StatusFilter = BusinessStatus | "ALL";

const EMPTY_TEXT: Record<StatusFilter, { title: string; text: string }> = {
  PENDING: { title: "No shops waiting", text: "New registrations appear here for you to approve." },
  ACTIVE: { title: "No active shops yet", text: "Shops you approve appear here." },
  SUSPENDED: { title: "No suspended shops", text: "Shops you put on hold appear here." },
  REJECTED: { title: "No rejected shops", text: "Registrations you turn down appear here." },
  ALL: { title: "No shops yet", text: "Shops appear here as soon as they register." },
};
type Action = { shop: PlatformBusiness; to: "ACTIVE" | "SUSPENDED" | "REJECTED" };

const stateName = (code: string) => INDIAN_STATES.find((s) => s.code === code)?.name ?? code;

export function PlatformShopsPage() {
  const { token } = usePlatformToken();
  const [status, setStatus] = useState<StatusFilter>("PENDING");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<Action | null>(null);
  const shops = usePlatformShops(token, {
    status: status === "ALL" ? undefined : status,
    search: search.trim() || undefined,
    page,
  });

  const columns: Column<PlatformBusiness>[] = [
    {
      key: "shop",
      header: "Shop",
      cell: (s) => (
        <div className="min-w-0">
          <p className="font-medium text-ink">{s.name}</p>
          <p className="text-helper text-slate">
            {[s.city, stateName(s.stateCode)].filter(Boolean).join(", ")}
            {s.gstin && ` · ${s.gstin}`}
          </p>
        </div>
      ),
    },
    {
      key: "owner",
      header: "Owner",
      cell: (s) =>
        s.owner ? (
          <div className="min-w-0">
            <p className="text-ink">{s.owner.name}</p>
            <p className="text-helper text-slate">
              {s.owner.mobile && formatMobile(s.owner.mobile)}
              {s.owner.email && (
                <>
                  {" · "}
                  {s.owner.email}
                  {!s.owner.emailVerified && <span className="text-warning"> (not confirmed)</span>}
                </>
              )}
            </p>
          </div>
        ) : (
          <span className="text-slate">—</span>
        ),
    },
    { key: "registered", header: "Registered", cell: (s) => formatDate(s.createdAt) },
    {
      key: "status",
      header: "Status",
      cell: (s) => (
        <div>
          <Badge tone={STATUS_TONE[s.status]}>{BUSINESS_STATUS_LABELS[s.status]}</Badge>
          {s.statusNote && <p className="mt-1 max-w-[220px] truncate text-helper text-slate">{s.statusNote}</p>}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (s) => (
        <div className="flex justify-end gap-2">
          {s.status === "PENDING" && (
            <>
              <Button size="sm" variant="outline" onClick={() => setAction({ shop: s, to: "REJECTED" })}>
                Reject
              </Button>
              <Button size="sm" onClick={() => setAction({ shop: s, to: "ACTIVE" })}>
                Approve
              </Button>
            </>
          )}
          {s.status === "ACTIVE" && (
            <Button size="sm" variant="danger-outline" onClick={() => setAction({ shop: s, to: "SUSPENDED" })}>
              Suspend
            </Button>
          )}
          {(s.status === "SUSPENDED" || s.status === "REJECTED") && (
            <Button size="sm" variant="outline" onClick={() => setAction({ shop: s, to: "ACTIVE" })}>
              {s.status === "SUSPENDED" ? "Reactivate" : "Approve"}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-page font-bold text-ink">Shops</h1>
        <p className="text-body text-slate">New shops can log in only after you approve them.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="max-w-full overflow-x-auto">
          <SegmentedControl<StatusFilter>
            label="Status"
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={[
              { value: "PENDING", label: "Waiting" },
              { value: "ACTIVE", label: "Active" },
              { value: "SUSPENDED", label: "Suspended" },
              { value: "REJECTED", label: "Rejected" },
              { value: "ALL", label: "All" },
            ]}
          />
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input
            aria-label="Search shops"
            placeholder="Shop, city, mobile or email"
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>
      <div className="overflow-hidden rounded-card border border-border bg-surface">
        <DataTable
          columns={columns}
          rows={shops.data?.data}
          rowKey={(s) => s.id}
          loading={shops.isPending}
          error={shops.error}
          onRetry={() => shops.refetch()}
          empty={
            <EmptyState
              icon={Store}
              title={search.trim() ? "No shops match your search" : EMPTY_TEXT[status].title}
              description={search.trim() ? "Try a different name, city, mobile or email." : EMPTY_TEXT[status].text}
            />
          }
        />
        <Pagination meta={shops.data?.meta} onPage={setPage} />
      </div>
      {action && <StatusDialog action={action} token={token} onClose={() => setAction(null)} />}
    </div>
  );
}

const ACTION_TEXT: Record<Action["to"], { title: string; button: string; done: string; danger: boolean }> = {
  ACTIVE: { title: "Approve", button: "Approve", done: "approved", danger: false },
  REJECTED: { title: "Reject", button: "Reject", done: "rejected", danger: true },
  SUSPENDED: { title: "Suspend", button: "Suspend", done: "suspended", danger: true },
};

function StatusDialog({ action, token, onClose }: { action: Action; token: string | null; onClose: () => void }) {
  const update = useUpdateShopStatus(token);
  const toast = useToast();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const text = ACTION_TEXT[action.to];
  const reactivating = action.to === "ACTIVE" && action.shop.status === "SUSPENDED";

  const submit = async () => {
    setError(null);
    try {
      await update.mutateAsync({ id: action.shop.id, status: action.to, note });
      toast({ message: `${action.shop.name} ${reactivating ? "reactivated" : text.done}` });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${reactivating ? "Reactivate" : text.title} ${action.shop.name}?`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={text.danger ? "danger" : "primary"} loading={update.isPending} onClick={submit}>
            {reactivating ? "Reactivate" : text.button}
          </Button>
        </>
      }
    >
      <p className="text-body text-slate">
        {action.to === "ACTIVE" && "The owner and staff can log in and start billing. The owner gets an email."}
        {action.to === "REJECTED" && "The owner can't log in. They get an email saying the shop was not approved."}
        {action.to === "SUSPENDED" &&
          "Everyone in this shop is logged out at once and can't log in. Their data is kept. The owner gets an email."}
      </p>
      {error && <ErrorBanner className="mt-4" title={error} />}
      <Field label="Note to the owner" helper="Optional. Included in the email." className="mt-4">
        {(p) => <Textarea {...p} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>
    </Modal>
  );
}
