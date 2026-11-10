import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Keyboard key chip. `dark` for navy surfaces (POS header).
export function Kbd({ children, dark, className }: { children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-6 items-center justify-center rounded px-1.5 py-0.5 font-sans text-overline font-semibold whitespace-nowrap",
        dark ? "bg-white/10 text-white" : "border border-border bg-canvas text-ink",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
