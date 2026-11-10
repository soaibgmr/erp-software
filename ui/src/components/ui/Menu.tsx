import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
}

const GAP = 4;
const EDGE = 8;
// Must already be fixed when measured, otherwise the menu is a full-width block in <body>.
const HIDDEN: CSSProperties = { position: "fixed", top: 0, left: 0, visibility: "hidden" };

// 36px rows, 8px radius; destructive items go last, after a divider.
// Rendered in a portal with fixed positioning so scroll/overflow containers
// (e.g. tables) never clip it; flips above the trigger when space below runs out.
export function Menu({
  items,
  trigger,
  align = "right",
  label = "More actions",
}: {
  items: MenuItem[];
  trigger?: (props: { onClick: () => void; "aria-expanded": boolean }) => ReactNode;
  align?: "left" | "right";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>(HIDDEN);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const place = () => {
    const t = root.current?.getBoundingClientRect();
    const m = menu.current;
    if (!t || !m) return;
    const h = m.offsetHeight;
    const w = m.offsetWidth;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const below = vh - t.bottom - GAP - EDGE;
    const above = t.top - GAP - EDGE;
    const top = h <= below || below >= above ? t.bottom + GAP : Math.max(EDGE, t.top - GAP - h);

    let left = align === "right" ? t.right - w : t.left;
    left = Math.min(Math.max(EDGE, left), vw - w - EDGE);

    setStyle({ position: "fixed", top, left, visibility: "visible" });
  };

  useLayoutEffect(() => {
    if (open) place();
    else setStyle(HIDDEN);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!root.current?.contains(target) && !menu.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onScroll = (e: Event) => {
      if (menu.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const normal = items.filter((i) => !i.destructive);
  const destructive = items.filter((i) => i.destructive);
  const toggle = () => setOpen((o) => !o);

  const row = (item: MenuItem) => (
    <button
      key={item.label}
      type="button"
      role="menuitem"
      disabled={item.disabled}
      onClick={(e) => {
        e.stopPropagation();
        setOpen(false);
        item.onSelect();
      }}
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-[6px] px-3 text-left text-body hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-50",
        item.destructive ? "text-danger" : "text-ink",
      )}
    >
      {item.icon}
      {item.label}
    </button>
  );

  return (
    <div ref={root} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      {trigger ? (
        trigger({ onClick: toggle, "aria-expanded": open })
      ) : (
        <button
          type="button"
          aria-label={label}
          aria-expanded={open}
          onClick={toggle}
          className="inline-flex size-8 items-center justify-center rounded-input text-slate hover:bg-navy-50"
        >
          <MoreHorizontal className="size-[18px]" />
        </button>
      )}
      {open &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            style={style}
            onClick={(e) => e.stopPropagation()}
            className="z-50 min-w-48 rounded-menu border border-border bg-surface p-1.5 shadow-menu"
          >
            {normal.map(row)}
            {normal.length > 0 && destructive.length > 0 && <div className="my-1.5 border-t border-border" />}
            {destructive.map(row)}
          </div>,
          document.body,
        )}
    </div>
  );
}
