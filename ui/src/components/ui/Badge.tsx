import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "ready" | "highlight" | "navy";

const tones: Record<Tone, string> = {
  success: "bg-success-50 text-success",
  ready: "bg-[#e6f4f1] text-[#0f6b5c]",
  warning: "bg-warning-50 text-warning",
  danger: "bg-danger-50 text-danger",
  info: "bg-info-50 text-info",
  neutral: "bg-navy-50 text-slate",
  highlight: "bg-yellow-100 text-yellow-700",
  navy: "bg-navy-700 text-white",
};

// Pill with a leading dot, per the status badge spec.
export function Badge({
  tone = "neutral",
  dot = true,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-overline font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

// Count badge used in the sidebar and card headers.
export function CountBadge({ children, tone = "navy" }: { children: ReactNode; tone?: "navy" | "highlight" }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-6 items-center justify-center rounded-full px-1.5 text-overline font-semibold tabular",
        tone === "navy" ? "bg-navy-700 text-white" : "bg-yellow-100 text-yellow-700",
      )}
    >
      {children}
    </span>
  );
}
