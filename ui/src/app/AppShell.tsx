import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import { Bell, Car, Check, ChevronDown, LogOut, Menu as MenuIcon, Plus, Search, UserRound, X } from "lucide-react";
import { useAuth } from "./auth";
import { useHotkey } from "./hotkeys";
import { NAV } from "./nav";
import { CommandPalette } from "./CommandPalette";
import { Button } from "@/components/ui/Button";
import { Menu } from "@/components/ui/Menu";
import { cn, initials } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-input bg-yellow-500 text-navy-900",
        className,
      )}
    >
      <Car className="size-5" strokeWidth={2.25} aria-hidden />
    </span>
  );
}

export function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const navigate = useNavigate();
  const { can } = useAuth();

  useHotkey("mod+k", () => setPaletteOpen(true));
  useHotkey("f2", () => can("pos.use") && navigate("/pos"));
  useHotkey("f3", () => setPaletteOpen(true));

  return (
    <div className="min-h-screen lg:pl-[248px]">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <TopBar onSearch={() => setPaletteOpen(true)} onMenu={() => setNavOpen(true)} />
      <main className="px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-[1400px]">
          <Outlet />
        </div>
      </main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, can, branch, setBranch } = useAuth();
  if (!me) return null;
  const sections = NAV.map((s) => ({
    ...s,
    items: s.items.filter((i) => !i.permissions || can(...i.permissions)),
  })).filter((s) => s.items.length);
  const multiBranch = me.branches.length > 1;

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-navy-900/40 lg:hidden" onClick={onClose} aria-hidden />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col bg-navy-900 text-white transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 px-5 pt-5 pb-4">
          <Logo />
          <div className="min-w-0 flex-1">
            <p className="truncate text-card font-bold">Automobile.In</p>
            {multiBranch ? (
              <Menu
                align="left"
                items={me.branches.map((b) => ({
                  label: b.name,
                  icon: <Check className={cn("size-4", b.id === branch?.id ? "text-navy-700" : "invisible")} />,
                  onSelect: () => setBranch(b.id),
                }))}
                trigger={(p) => (
                  <button
                    type="button"
                    {...p}
                    className="flex max-w-full items-center gap-1 text-helper text-white/70 hover:text-white"
                  >
                    <span className="truncate">{branchLabel(branch)}</span>
                    <ChevronDown className="size-3.5 shrink-0" />
                  </button>
                )}
              />
            ) : (
              <p className="truncate text-helper text-white/70">{branchLabel(branch)}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-input p-1 text-white/70 lg:hidden"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
          {sections.map((section) => (
            <div key={section.section} className="mt-4 first:mt-1">
              <p className="eyebrow px-3 pb-2 text-white/50">{section.section}</p>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === "/"}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          "flex h-10 items-center gap-3 rounded-input px-3 text-body font-medium transition-colors",
                          isActive ? "bg-white/10 text-yellow-400" : "text-white/85 hover:bg-white/5 hover:text-white",
                        )
                      }
                    >
                      <item.icon className="size-[18px] shrink-0" strokeWidth={2} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.shortcut && <span className="text-overline text-white/50">{item.shortcut}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="p-3">
          <NavLink
            to="/profile"
            onClick={onClose}
            className="flex items-center gap-3 rounded-card bg-white/5 px-3 py-3 hover:bg-white/10"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy-600 text-helper font-semibold">
              {initials(me.user.firstName, me.user.lastName)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-body font-semibold">
                {me.user.firstName} {me.user.lastName}
              </span>
              <span className="block truncate text-overline font-normal text-white/60">{me.user.role.name}</span>
            </span>
          </NavLink>
        </div>
      </aside>
    </>
  );
}

const branchLabel = (b: { name: string; city: string | null } | undefined) =>
  b ? [b.city, b.name].filter(Boolean).join(" · ") : "No branch assigned";

function TopBar({ onSearch, onMenu }: { onSearch: () => void; onMenu: () => void }) {
  const { me, can, logout } = useAuth();
  const navigate = useNavigate();
  if (!me) return null;
  const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6">
      <button
        type="button"
        onClick={onMenu}
        className="rounded-input p-2 text-navy-700 hover:bg-navy-50 lg:hidden"
        aria-label="Open menu"
      >
        <MenuIcon className="size-5" />
      </button>
      <button
        type="button"
        onClick={onSearch}
        className="flex h-10 w-full max-w-[505px] min-w-0 items-center gap-2.5 rounded-input border border-border bg-canvas px-3 text-left text-body text-muted hover:border-navy-100"
      >
        <Search className="size-4 shrink-0 text-slate" />
        <span className="flex-1 truncate">Search invoices, parts, vehicle no…</span>
        <kbd className="hidden rounded border border-border bg-surface px-1.5 py-0.5 font-sans text-overline text-slate sm:inline">
          {isMac ? "⌘ K" : "Ctrl K"}
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2.5">
        {can("pos.use") && (
          <span className="hidden sm:block">
            <Button icon={<Plus className="size-4" />} onClick={() => navigate("/pos")}>
              New bill
            </Button>
          </span>
        )}
        <button
          type="button"
          aria-label="Notifications"
          className="relative inline-flex size-10 items-center justify-center rounded-input border border-border text-navy-700 hover:bg-navy-50"
        >
          <Bell className="size-[18px]" />
        </button>
        <Menu
          items={[
            { label: "My profile", icon: <UserRound className="size-4" />, onSelect: () => navigate("/profile") },
            { label: "Log out", icon: <LogOut className="size-4" />, destructive: true, onSelect: () => void logout() },
          ]}
          trigger={(p) => (
            <button
              type="button"
              {...p}
              aria-label="Account menu"
              className="flex h-10 items-center gap-1.5 rounded-input border border-border pr-2 pl-1 hover:bg-navy-50"
            >
              <span className="flex size-8 items-center justify-center rounded-[5px] bg-navy-900 text-helper font-bold text-yellow-400">
                {initials(me.user.firstName, me.user.lastName)}
              </span>
              <ChevronDown className="size-4 text-slate" />
            </button>
          )}
        />
      </div>
    </header>
  );
}
