import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { ArrowRight, FileText, Package, Search, Users } from "lucide-react";
import { useAuth } from "./auth";
import { ALL_NAV_ITEMS } from "./nav";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: typeof Search;
  run: () => void;
}

// Ctrl/⌘ K: jump to any page, or search invoices, customers and parts.
// Mounted only while open, so every opening starts with an empty query.
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <Palette onClose={onClose} /> : null;
}

function Palette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const { can } = useAuth();

  const commands = useMemo<Command[]>(() => {
    const q = query.trim().toLowerCase();
    const go = (to: string) => () => {
      navigate(to);
      onClose();
    };
    const pages: Command[] = ALL_NAV_ITEMS.filter((i) => !i.permissions || can(...i.permissions))
      .filter((i) => !q || i.label.toLowerCase().includes(q))
      .map((i) => ({ id: i.to, label: i.label, hint: i.shortcut ?? "Go to", icon: i.icon, run: go(i.to) }));
    const term = encodeURIComponent(query.trim());
    const search: Command[] = [];
    if (q && can("invoice.view", "invoice.create")) {
      search.push({
        id: "search-invoices",
        label: `Search invoices for “${query.trim()}”`,
        icon: FileText,
        run: go(`/invoices?search=${term}`),
      });
    }
    if (q && can("customer.view", "customer.manage")) {
      search.push({
        id: "search-customers",
        label: `Search customers for “${query.trim()}”`,
        icon: Users,
        run: go(`/customers?search=${term}`),
      });
    }
    if (q && can("inventory.view", "inventory.manage")) {
      search.push({
        id: "search-parts",
        label: `Search parts for “${query.trim()}”`,
        icon: Package,
        run: go(`/inventory?search=${term}`),
      });
    }
    return [...search, ...pages];
  }, [query, can, navigate, onClose]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, commands.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commands[active]?.run();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-center bg-navy-900/40 px-4 pt-[12vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="h-fit w-full max-w-[560px] overflow-hidden rounded-modal bg-surface shadow-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-[18px] text-slate" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search pages, invoices, customers and parts…"
            className="h-14 flex-1 bg-transparent text-card text-ink placeholder:text-muted focus:outline-none"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-overline text-slate">Esc</kbd>
        </div>
        <ul id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {commands.length === 0 && <li className="px-3 py-6 text-center text-body text-slate">No matches</li>}
          {commands.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={c.run}
                className={cn(
                  "flex h-11 w-full items-center gap-3 rounded-menu px-3 text-left text-body",
                  i === active ? "bg-navy-50 text-ink" : "text-ink",
                )}
              >
                <c.icon className="size-[18px] text-slate" />
                <span className="flex-1 truncate">{c.label}</span>
                {i === active ? (
                  <ArrowRight className="size-4 text-slate" />
                ) : (
                  c.hint && <span className="text-overline text-muted">{c.hint}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
