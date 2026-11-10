import type { ReactNode } from "react";
import { BadgeIndianRupee, Boxes, FileSpreadsheet, ShieldCheck, Users } from "lucide-react";
import { Logo } from "@/app/AppShell";
import { cn } from "@/lib/utils";

const YEAR = new Date().getFullYear();

const FEATURES = [
  {
    icon: BadgeIndianRupee,
    title: "Fast GST billing",
    text: "Scan or search a product, bill in seconds, print A4 or thermal.",
  },
  { icon: Boxes, title: "Stock in every branch", text: "Live stock, low-stock alerts and transfers between branches." },
  { icon: Users, title: "Customer dues", text: "Pay later bills, dues limits and who owes what, at a glance." },
  {
    icon: FileSpreadsheet,
    title: "GST reports",
    text: "GSTR-1, GSTR-3B, HSN summary and Tally export, ready to file.",
  },
];

// Full-screen frame for the pages people see before signing in: login, shop sign-up,
// forgot / reset password and the confirm-email link. Brand panel on the left (desktop), form on the right.
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="grid min-h-screen bg-surface lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <BrandPanel />

      <main className="flex min-h-screen flex-col">
        {/* Below lg the brand panel is hidden; keep the name visible above the form. */}
        <div className="flex items-center gap-3 px-6 pt-6 lg:hidden">
          <Logo className="size-9" />
          <p className="text-card font-bold text-ink">ERP Software</p>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className={cn("w-full", wide ? "max-w-[600px]" : "max-w-[400px]")}>
            <h1 className="text-page font-bold tracking-[-0.01em] text-ink">{title}</h1>
            {subtitle && <p className="mt-1.5 text-body text-slate">{subtitle}</p>}
            {children}
            {footer && <div className="mt-8 border-t border-border pt-6 text-body text-slate">{footer}</div>}
          </div>
        </div>

        <p className="px-6 pb-6 text-center text-helper text-muted lg:text-left">
          © {YEAR} ERP Software · Each business's data is kept separate and private.
        </p>
      </main>
    </div>
  );
}

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-navy-900 text-white lg:flex lg:flex-col">
      {/* Soft background pattern: a dotted grid and two glows. Decorative only. */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]" aria-hidden>
        <defs>
          <pattern id="auth-dots" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.5" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#auth-dots)" />
      </svg>
      <div className="pointer-events-none absolute -top-32 -right-24 size-[420px] rounded-full bg-navy-600/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-24 size-[380px] rounded-full bg-yellow-500/15 blur-3xl" />

      <div className="relative flex flex-1 flex-col px-12 py-10 xl:px-16">
        <div className="flex items-center gap-3">
          <Logo className="size-10" />
          <div>
            <p className="text-card font-bold">ERP Software</p>
            <p className="text-helper text-white/60">Billing & inventory for every business</p>
          </div>
        </div>

        <div className="my-auto max-w-[480px] py-12">
          <p className="eyebrow text-yellow-400">Billing · Stock · GST</p>
          <h2 className="mt-3 text-[2rem] leading-[2.5rem] font-bold tracking-[-0.02em] xl:text-[2.375rem] xl:leading-[2.875rem]">
            Run your whole business from one screen.
          </h2>
          <p className="mt-4 text-card text-white/70">
            Bills, stock, customer dues and GST returns for every branch. Built for Indian businesses of every kind.
          </p>

          <ul className="mt-10 space-y-5">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-input bg-white/10 text-yellow-400 ring-1 ring-white/10">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="mt-0.5 text-body text-white/60">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-2 text-helper text-white/60">
          <ShieldCheck className="size-4 text-yellow-400" aria-hidden />
          Secure login · Your data stays with your business
        </div>
      </div>
    </aside>
  );
}

// Green confirmation box used after sign-up, reset and confirm-email.
export function SuccessBox({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div role="status" className="mt-6 rounded-card border border-success/30 bg-success-50 p-4">
      <p className="font-semibold text-success">{title}</p>
      {children && <div className="mt-1 text-helper text-ink">{children}</div>}
    </div>
  );
}
