import { useEffect, useState, type ReactNode } from "react";
import { Navigate, NavLink, Outlet, useNavigate } from "react-router";
import {
  CalendarCheck,
  ChevronDown,
  CircleCheck,
  Clock,
  KeyRound,
  Loader2,
  LogOut,
  PauseCircle,
  Search,
  Store,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { BUSINESS_STATUS_LABELS, formatMobile, INDIAN_STATES, type BusinessStatus } from "@erp-software/shared";
import { Logo } from "@/app/AppShell";
import { Badge, CountBadge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DescriptionList, PageHeader } from "@/components/ui/Controls";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Menu } from "@/components/ui/Menu";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorBanner } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { APP_NAME } from "@/lib/brand";
import type { PlatformBusiness, PlatformSummary } from "@/lib/types";
import { cn, errorMessage, formatDate, formatDateTime } from "@/lib/utils";
import { usePlatformMe, usePlatformShops, usePlatformSummary, usePlatformToken, useUpdateShopStatus } from "./api";

// ---- Shell: signed-in admin only ----

export function PlatformShell() {
  const { token, signOut } = usePlatformToken();
  const me = usePlatformMe(token);
  const summary = usePlatformSummary(token);
  const navigate = useNavigate();

  // Expired or revoked token (e.g. the password was changed on another device): back to the login page.
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

  const waiting = summary.data?.shops.PENDING ?? 0;
  const toCall = summary.data?.openDemoRequests ?? 0;
  const links: { to: string; label: string; icon: LucideIcon; count: number }[] = [
    { to: "/admin/shops", label: "Shops", icon: Store, count: waiting },
    { to: "/admin/demo-requests", label: "Demo requests", icon: CalendarCheck, count: toCall },
  ];
  const nav = (className: string) => (
    <nav className={className} aria-label="Admin pages">
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          className={({ isActive }) =>
            cn(
              "flex h-9 shrink-0 items-center gap-2 rounded-input px-3 text-body font-medium transition-colors",
              isActive ? "bg-white/10 text-yellow-400" : "text-white/85 hover:bg-white/5 hover:text-white",
            )
          }
        >
          <l.icon className="size-4" strokeWidth={2} />
          {l.label}
          {l.count > 0 && <CountBadge tone="highlight">{l.count}</CountBadge>}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-20 bg-navy-900 text-white">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-4 sm:px-6">
          <Logo />
          <div className="min-w-0">
            <p className="truncate text-card font-bold">{APP_NAME}</p>
            <p className="text-overline text-white/60">Platform admin</p>
          </div>
          {nav("ml-6 hidden items-center gap-1 md:flex")}
          <div className="ml-auto">
            <Menu
              label="Your account"
              items={[
                {
                  label: "Account & password",
                  icon: <KeyRound className="size-4" />,
                  onSelect: () => navigate("/admin/account"),
                },
                { label: "Log out", icon: <LogOut className="size-4" />, destructive: true, onSelect: signOut },
              ]}
              trigger={(p) => (
                <button
                  type="button"
                  {...p}
                  className="flex items-center gap-2.5 rounded-input px-2 py-1.5 text-left hover:bg-white/10"
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-navy-600 text-helper font-semibold">
                    {me.data.name.trim()[0]?.toUpperCase() ?? "A"}
                  </span>
                  <span className="hidden min-w-0 sm:block">
                    <span className="block max-w-[200px] truncate text-body font-semibold">{me.data.name}</span>
                    <span className="block max-w-[200px] truncate text-overline font-normal text-white/60">
                      {me.data.email}
                    </span>
                  </span>
                  <ChevronDown className="size-4 text-white/70" />
                </button>
              )}
            />
          </div>
        </div>
        {nav("flex gap-1 overflow-x-auto px-4 pb-2 md:hidden")}
      </header>
      <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
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

const FILTERS: { value: StatusFilter; label: string; hint: string; icon: LucideIcon; iconClass: string }[] = [
  {
    value: "PENDING",
    label: "Waiting",
    hint: "Need your approval",
    icon: Clock,
    iconClass: "bg-warning-50 text-warning",
  },
  { value: "ACTIVE", label: "Active", hint: "Billing now", icon: CircleCheck, iconClass: "bg-success-50 text-success" },
  {
    value: "SUSPENDED",
    label: "Suspended",
    hint: "On hold, data kept",
    icon: PauseCircle,
    iconClass: "bg-danger-50 text-danger",
  },
  { value: "REJECTED", label: "Rejected", hint: "Not approved", icon: XCircle, iconClass: "bg-canvas text-slate" },
  { value: "ALL", label: "All shops", hint: "Every registration", icon: Store, iconClass: "bg-navy-50 text-navy-700" },
];

const EMPTY_TEXT: Record<StatusFilter, { title: string; text: string }> = {
  PENDING: { title: "No shops waiting", text: "New registrations appear here for you to approve." },
  ACTIVE: { title: "No active shops yet", text: "Shops you approve appear here." },
  SUSPENDED: { title: "No suspended shops", text: "Shops you put on hold appear here." },
  REJECTED: { title: "No rejected shops", text: "Registrations you turn down appear here." },
  ALL: { title: "No shops yet", text: "Shops appear here as soon as they register." },
};
type Action = { shop: PlatformBusiness; to: "ACTIVE" | "SUSPENDED" | "REJECTED" };

const stateName = (code: string) => INDIAN_STATES.find((s) => s.code === code)?.name ?? code;

const countFor = (summary: PlatformSummary | undefined, filter: StatusFilter) =>
  summary
    ? filter === "ALL"
      ? Object.values(summary.shops).reduce((a, b) => a + b, 0)
      : summary.shops[filter]
    : undefined;

export function PlatformShopsPage() {
  const { token } = usePlatformToken();
  const [status, setStatus] = useState<StatusFilter>("PENDING");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<Action | null>(null);
  const [viewing, setViewing] = useState<PlatformBusiness | null>(null);
  const summary = usePlatformSummary(token);
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
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-input bg-navy-50 text-helper font-semibold text-navy-700">
            {s.name.trim()[0]?.toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{s.name}</p>
            <p className="truncate text-helper text-slate">
              {[s.city, stateName(s.stateCode)].filter(Boolean).join(", ")}
            </p>
          </div>
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
              {s.owner.mobile ? formatMobile(s.owner.mobile) : s.owner.email}
              {s.owner.email && !s.owner.emailVerified && <span className="text-warning"> · email not confirmed</span>}
            </p>
          </div>
        ) : (
          <span className="text-slate">—</span>
        ),
    },
    {
      key: "gstin",
      header: "GSTIN",
      cell: (s) => (s.gstin ? <span className="font-mono text-helper">{s.gstin}</span> : <Badge>Not added</Badge>),
    },
    { key: "registered", header: "Registered", cell: (s) => formatDate(s.createdAt) },
    {
      key: "status",
      header: "Status",
      cell: (s) => <Badge tone={STATUS_TONE[s.status]}>{BUSINESS_STATUS_LABELS[s.status]}</Badge>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (s) => <ShopActions shop={s} onAction={setAction} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Shops"
        description="Approve new registrations, and suspend or reactivate shops. Shops can log in only after you approve them."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" role="group" aria-label="Filter by status">
        {FILTERS.map((f) => {
          const selected = status === f.value;
          const count = countFor(summary.data, f.value);
          return (
            <button
              key={f.value}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setStatus(f.value);
                setPage(1);
              }}
              className={cn(
                "rounded-card border bg-surface p-4 text-left transition-colors hover:border-navy-100",
                selected ? "border-navy-600 ring-1 ring-navy-600" : "border-border",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn("flex size-8 items-center justify-center rounded-input", f.iconClass)}>
                  <f.icon className="size-4" strokeWidth={2.25} />
                </span>
                <span className="text-kpi font-bold text-ink tabular">{count ?? "–"}</span>
              </div>
              <p className="mt-3 text-body font-semibold text-ink">{f.label}</p>
              <p className="text-helper text-slate">{f.hint}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-6 overflow-hidden rounded-card border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <p className="text-body font-semibold text-ink">
            {FILTERS.find((f) => f.value === status)?.label}
            {shops.data && <span className="ml-2 font-normal text-slate">{shops.data.meta.total}</span>}
          </p>
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input
              aria-label="Search shops"
              placeholder="Shop, city, mobile or email"
              className="px-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-input p-1 text-slate hover:bg-navy-50"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={shops.data?.data}
          rowKey={(s) => s.id}
          loading={shops.isPending}
          error={shops.error}
          onRetry={() => shops.refetch()}
          onRowClick={setViewing}
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

      {viewing && (
        <ShopDetails
          shop={shops.data?.data.find((s) => s.id === viewing.id) ?? viewing}
          onClose={() => setViewing(null)}
          onAction={(a) => {
            setViewing(null);
            setAction(a);
          }}
        />
      )}
      {action && <StatusDialog action={action} token={token} onClose={() => setAction(null)} />}
    </div>
  );
}

// The buttons a shop's status allows. Clicks don't open the row's details.
function ShopActions({ shop, onAction }: { shop: PlatformBusiness; onAction: (a: Action) => void }) {
  return (
    // react-doctor-disable-next-line react-doctor/no-static-element-interactions
    <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {shop.status === "PENDING" && (
        <>
          <Button size="sm" variant="outline" onClick={() => onAction({ shop, to: "REJECTED" })}>
            Reject
          </Button>
          <Button size="sm" onClick={() => onAction({ shop, to: "ACTIVE" })}>
            Approve
          </Button>
        </>
      )}
      {shop.status === "ACTIVE" && (
        <Button size="sm" variant="danger-outline" onClick={() => onAction({ shop, to: "SUSPENDED" })}>
          Suspend
        </Button>
      )}
      {(shop.status === "SUSPENDED" || shop.status === "REJECTED") && (
        <Button size="sm" variant="outline" onClick={() => onAction({ shop, to: "ACTIVE" })}>
          {shop.status === "SUSPENDED" ? "Reactivate" : "Approve"}
        </Button>
      )}
    </div>
  );
}

function ShopDetails({
  shop,
  onClose,
  onAction,
}: {
  shop: PlatformBusiness;
  onClose: () => void;
  onAction: (a: Action) => void;
}) {
  const section = (title: string, children: ReactNode) => (
    <section className="border-t border-border pt-4 first:border-0 first:pt-0">
      <h3 className="eyebrow mb-3 text-slate">{title}</h3>
      {children}
    </section>
  );
  return (
    <Modal
      open
      size="md"
      onClose={onClose}
      title={shop.name}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <ShopActions shop={shop} onAction={onAction} />
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[shop.status]}>{BUSINESS_STATUS_LABELS[shop.status]}</Badge>
          {shop.statusNote && <span className="text-helper text-slate">“{shop.statusNote}”</span>}
        </div>
        {section(
          "Business",
          <DescriptionList
            items={[
              { label: "Legal name", value: shop.legalName },
              { label: "GSTIN", value: shop.gstin ?? "Not added yet (needed before billing)" },
              { label: "City", value: shop.city },
              { label: "State", value: stateName(shop.stateCode) },
            ]}
          />,
        )}
        {section(
          "Owner",
          shop.owner ? (
            <DescriptionList
              items={[
                { label: "Name", value: shop.owner.name },
                {
                  label: "Mobile",
                  value: shop.owner.mobile && (
                    <a href={`tel:+91${shop.owner.mobile}`} className="text-navy-600 hover:underline">
                      {formatMobile(shop.owner.mobile)}
                    </a>
                  ),
                },
                {
                  label: "Email",
                  value: shop.owner.email && (
                    <span>
                      <a href={`mailto:${shop.owner.email}`} className="text-navy-600 hover:underline">
                        {shop.owner.email}
                      </a>
                      <span className={shop.owner.emailVerified ? "text-success" : "text-warning"}>
                        {shop.owner.emailVerified ? " · confirmed" : " · not confirmed"}
                      </span>
                    </span>
                  ),
                },
              ]}
            />
          ) : (
            <p className="text-body text-slate">No active owner.</p>
          ),
        )}
        {section(
          "Usage",
          <DescriptionList
            items={[
              { label: "Branches", value: String(shop.branchCount) },
              { label: "Staff logins", value: String(shop.userCount) },
              { label: "Registered", value: formatDateTime(shop.createdAt) },
              { label: "Approved", value: shop.approvedAt ? formatDateTime(shop.approvedAt) : "Not yet" },
            ]}
          />,
        )}
      </div>
    </Modal>
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
      {action.to === "ACTIVE" && !action.shop.gstin && (
        <p className="mt-3 rounded-input bg-warning-50 px-3 py-2 text-helper text-ink">
          This shop has no GSTIN yet. They can log in, but can't save bills until they add it.
        </p>
      )}
      {error && <ErrorBanner className="mt-4" title={error} />}
      <Field label="Note to the owner" helper="Optional. Included in the email." className="mt-4">
        {(p) => <Textarea {...p} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>
    </Modal>
  );
}
