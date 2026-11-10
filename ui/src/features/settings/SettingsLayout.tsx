import { Navigate, NavLink, Outlet, useLocation } from "react-router";
import type { Permission } from "@automobile/shared";
import { useAuth } from "@/app/auth";
import { PageHeader } from "@/components/ui/Controls";
import { cn } from "@/lib/utils";

export const SETTINGS_TABS: { to: string; label: string; permission: Permission }[] = [
  { to: "business", label: "Business profile", permission: "settings.manage" },
  { to: "branches", label: "Branches", permission: "branch.manage" },
  { to: "users", label: "Users", permission: "user.manage" },
  { to: "roles", label: "Roles & permissions", permission: "role.manage" },
  { to: "number-series", label: "Number series", permission: "settings.manage" },
  { to: "billing", label: "Billing & tax", permission: "settings.manage" },
  { to: "audit", label: "Audit log", permission: "audit.view" },
];

export function SettingsLayout() {
  const { can } = useAuth();
  const { pathname } = useLocation();
  const tabs = SETTINGS_TABS.filter((t) => can(t.permission));

  if (pathname.replace(/\/$/, "") === "/settings") {
    return tabs[0] ? <Navigate to={tabs[0].to} replace /> : <Navigate to="/" replace />;
  }

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Settings" className="flex gap-1 overflow-x-auto lg:flex-col">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                cn(
                  "flex h-10 shrink-0 items-center rounded-input px-3 text-body font-medium whitespace-nowrap",
                  isActive ? "bg-navy-700 text-white" : "text-slate hover:bg-navy-50 hover:text-ink",
                )
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </>
  );
}

// Route guard for a settings tab the user can't open (e.g. a bookmarked URL).
export function RequirePermission({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { can } = useAuth();
  return can(permission) ? <>{children}</> : <Navigate to="/settings" replace />;
}
