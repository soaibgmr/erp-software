import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  Check,
  FileJson,
  FileSpreadsheet,
  Menu,
  Printer,
  Receipt,
  ScanBarcode,
  Search,
  ShieldCheck,
  UserCheck,
  Wallet,
  X,
} from "lucide-react";
import { Logo } from "@/app/AppShell";
import { buttonClasses } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Kbd";
import { APP_NAME, CONTACT_EMAIL } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { DemoRequestSection } from "./DemoRequestSection";

// Public page shown at "/" to visitors who aren't signed in.
// Every claim and every number on it matches what the app does today; keep it that way when features change.
// The pictures (bill, dues card, stock list…) are drawn with markup, so they stay sharp and load instantly.

const YEAR = new Date().getFullYear();

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#demo", label: "Book a demo" },
  { href: "#faq", label: "Questions" },
];

export function LandingPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = `${APP_NAME} · Billing, stock and GST for auto parts shops`;
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="min-h-screen bg-surface pb-20 text-ink sm:pb-0">
      <Header />
      <main>
        <Hero />
        <ProofStrip />
        <Features />
        <Steps />
        <DemoRequestSection />
        <Faq />
        <ClosingCta />
      </main>
      <Footer />
      <MobileCtaBar />
    </div>
  );
}

// ---------------------------------------------------------------- Header

function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 text-white transition-colors duration-300",
        scrolled || open ? "bg-navy-900/95 shadow-menu backdrop-blur" : "bg-navy-900",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <Logo className="size-8" />
          <span className="text-card font-bold">{APP_NAME}</span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 text-body md:flex" aria-label="Page sections">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-input px-3 py-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/login"
            className="hidden rounded-input px-3 py-2 text-body font-semibold text-white/90 hover:bg-white/10 sm:inline-flex"
          >
            Log in
          </Link>
          <Link to="/register" className={buttonClasses("accent", "sm", "hidden sm:inline-flex")}>
            Start free
          </Link>
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-input hover:bg-white/10 md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-white/10 px-4 pt-2 pb-4 md:hidden" aria-label="Page sections">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-input px-3 py-3 text-card text-white/85 hover:bg-white/10"
            >
              {l.label}
            </a>
          ))}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link to="/login" className={buttonClasses("outline", "md", "border-white/25 bg-transparent text-white")}>
              Log in
            </Link>
            <Link to="/register" className={buttonClasses("accent", "md")}>
              Start free
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

// ---------------------------------------------------------------- Hero

function DotGrid({ id, className }: { id: string; className?: string }) {
  return (
    <svg className={cn("pointer-events-none absolute inset-0 h-full w-full", className)} aria-hidden>
      <defs>
        <pattern id={id} width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.5" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-navy-900 text-white">
      <DotGrid id="hero-dots" className="opacity-[0.06]" />
      <div className="pointer-events-none absolute -top-48 right-[-10%] size-[640px] rounded-full bg-navy-600/45 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-56 -left-32 size-[520px] rounded-full bg-yellow-500/15 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4 pt-14 pb-24 sm:px-6 lg:pt-20 lg:pb-32">
        <div className="mx-auto max-w-3xl text-center motion-safe:animate-rise">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-helper text-white/85 ring-1 ring-white/15">
            <span className="size-2 rounded-full bg-yellow-400 motion-safe:animate-pulse-ring" aria-hidden />
            Made for Indian auto parts shops
          </p>
          <h1 className="mt-6 text-[2.5rem] leading-[1.1] font-bold tracking-[-0.03em] sm:text-[3.5rem] lg:text-[4rem]">
            Bill faster. Know your stock.{" "}
            <span className="relative whitespace-nowrap text-yellow-400">
              Collect your dues.
              <svg
                className="absolute -bottom-2 left-0 h-3 w-full text-yellow-400/60"
                viewBox="0 0 300 12"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path
                  d="M2 9C80 3 220 3 298 8"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-card text-white/70 sm:text-section">
            GST billing, stock for every branch and customer dues on one simple screen. Your counter staff will learn it
            in minutes.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/register" className={buttonClasses("accent", "lg", "shadow-[0_8px_24px_rgb(245_184_0/0.25)]")}>
              Start free <ArrowRight className="size-5" aria-hidden />
            </Link>
            <a
              href="#demo"
              className={buttonClasses("outline", "lg", "border-white/25 bg-white/5 text-white hover:bg-white/10")}
            >
              <CalendarCheck className="size-5" aria-hidden /> Book a quick demo
            </a>
          </div>
          <ul className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2 text-helper text-white/65">
            {["No installation", "Works with any printer", "Each shop's data kept private"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="size-4 text-yellow-400" aria-hidden /> {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto mt-16 max-w-5xl motion-safe:animate-rise motion-safe:[animation-delay:150ms]">
          <PosMock />
        </div>
      </div>
    </section>
  );
}

// A drawing of the POS screen. The bill adds up: ₹4,400 taxable + 9% CGST + 9% SGST = ₹5,192.
const TILES = [
  { cat: "Brakes", name: "Brake pad set, front", price: "1,850", stock: "12 in stock", tone: "ok" },
  { cat: "Lubricants", name: "Engine oil 5W-30, 3.5 L", price: "2,100", stock: "24 in stock", tone: "ok" },
  { cat: "Clutch", name: "Clutch plate", price: "2,450", stock: "Only 2 left", tone: "low" },
  { cat: "Electrical", name: "Spark plug, iridium", price: "640", stock: "40 in stock", tone: "ok" },
  { cat: "Filters", name: "Air filter", price: "380", stock: "Out of stock", tone: "out" },
  { cat: "Wipers", name: "Wiper blade, 22 in", price: "520", stock: "9 in stock", tone: "ok" },
  { cat: "Lighting", name: "Headlamp bulb H4", price: "290", stock: "18 in stock", tone: "ok" },
  { cat: "Batteries", name: "Battery 35 Ah", price: "4,250", stock: "Only 3 left", tone: "low" },
  { cat: "Brakes", name: "Brake fluid DOT 4", price: "310", stock: "15 in stock", tone: "ok" },
] as const;

const CART = [
  { name: "Brake pad set, front", meta: "HSN 8708 · 1 × ₹1,850.00", amount: "1,850.00" },
  { name: "Engine oil 5W-30, 3.5 L", meta: "HSN 2710 · 1 × ₹2,100.00", amount: "2,100.00" },
  { name: "Brake service (labour)", meta: "SAC 9987 · 1 × ₹450.00", amount: "450.00" },
];

const STOCK_TONE = { ok: "text-success", low: "text-warning", out: "text-danger" } as const;

function PosMock() {
  return (
    <div className="relative" aria-hidden>
      <div className="absolute -inset-3 rounded-[24px] bg-white/[0.04] ring-1 ring-white/10 sm:-inset-5" />
      <div className="relative overflow-hidden rounded-modal bg-canvas text-ink shadow-[0_40px_80px_rgb(0_0_0/0.35)] ring-1 ring-black/5">
        {/* POS top bar */}
        <div className="flex items-center gap-3 bg-navy-900 px-4 py-2.5 text-white">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-white/20" />
            <span className="size-2.5 rounded-full bg-white/20" />
            <span className="size-2.5 rounded-full bg-white/20" />
          </div>
          <p className="truncate text-helper text-white/80">POS billing · Counter 1</p>
          <div className="ml-auto hidden items-center gap-3 text-overline text-white/70 sm:flex">
            <span className="flex items-center gap-1.5">
              <Kbd dark>F3</Kbd> Search
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd dark>F8</Kbd> Hold
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd dark>F12</Kbd> Charge
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          {/* Products */}
          <div className="hidden border-r border-border p-4 md:block">
            <div className="flex h-10 items-center gap-2 rounded-input border border-border bg-surface px-3 text-helper text-muted">
              <Search className="size-4" /> Scan a barcode, or search name, SKU, OEM no.
            </div>
            <div className="mt-3 flex gap-2">
              {["All", "Brakes", "Lubricants", "Clutch", "Labour"].map((c, i) => (
                <span
                  key={c}
                  className={cn(
                    "rounded-full px-3 py-1 text-overline font-semibold",
                    i === 0 ? "bg-navy-700 text-white" : "border border-border bg-surface text-slate",
                  )}
                >
                  {c}
                </span>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {TILES.map((t) => (
                <div
                  key={t.name}
                  className={cn(
                    "rounded-input border bg-surface p-2.5",
                    t.name === "Brake pad set, front" ? "border-navy-600 ring-2 ring-navy-600/15" : "border-border",
                    t.tone === "out" && "opacity-60",
                  )}
                >
                  <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">{t.cat}</p>
                  <p className="mt-0.5 line-clamp-2 min-h-8 text-helper leading-4 font-medium">{t.name}</p>
                  <div className="mt-1.5 flex items-baseline justify-between gap-1">
                    <span className="tabular text-helper font-semibold">₹{t.price}</span>
                    <span className={cn("truncate text-[10px] font-medium", STOCK_TONE[t.tone])}>{t.stock}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cart */}
          <div className="bg-surface">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="eyebrow text-slate">Customer</p>
                <p className="truncate text-body font-semibold">Ravi Kumar · 98765 43210</p>
              </div>
              <span className="rounded-full bg-warning-50 px-2 py-0.5 text-overline font-semibold text-warning">
                Owes ₹1,200
              </span>
            </div>
            <ul className="divide-y divide-border px-4">
              {CART.map((l) => (
                <li key={l.name} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-body font-medium">{l.name}</p>
                    <p className="text-overline text-slate">{l.meta}</p>
                  </div>
                  <p className="tabular text-body font-medium">₹{l.amount}</p>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t border-border bg-navy-50 px-4 py-3 text-helper">
              {[
                ["Taxable value", "4,400.00"],
                ["CGST 9%", "396.00"],
                ["SGST 9%", "396.00"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-slate">
                  <dt>{k}</dt>
                  <dd className="tabular">₹{v}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between pt-1">
                <dt className="text-body font-semibold text-ink">Total payable</dt>
                <dd className="tabular text-kpi font-bold text-navy-900">₹5,192</dd>
              </div>
            </dl>
            <div className="grid grid-cols-4 gap-1.5 px-4 pt-3">
              {["Cash", "UPI", "Card", "Pay later"].map((m, i) => (
                <span
                  key={m}
                  className={cn(
                    "rounded-input border py-1.5 text-center text-overline font-semibold",
                    i === 1 ? "border-navy-700 bg-navy-700 text-white" : "border-border text-slate",
                  )}
                >
                  {m}
                </span>
              ))}
            </div>
            <div className="p-4">
              <span className={buttonClasses("accent", "lg", "w-full justify-between")}>
                Charge ₹5,192 <Kbd className="border-navy-900/15 bg-navy-900/10">F12</Kbd>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating notes */}
      <FloatCard className="top-28 -left-48 hidden xl:flex" delay="0s">
        <span className="flex size-9 items-center justify-center rounded-input bg-info-50 text-info">
          <FileJson className="size-5" />
        </span>
        <div>
          <p className="text-overline text-slate">GSTR-1</p>
          <p className="text-body font-semibold">Portal JSON ready</p>
        </div>
      </FloatCard>
      <FloatCard className="-right-44 bottom-24 hidden xl:flex" delay="1.5s">
        <span className="flex size-9 items-center justify-center rounded-input bg-success-50 text-success">
          <Check className="size-5" />
        </span>
        <div>
          <p className="text-overline text-slate">Bill saved · Printed</p>
          <p className="text-body font-semibold">INV-26-00184</p>
        </div>
      </FloatCard>
    </div>
  );
}

function FloatCard({ className, delay, children }: { className?: string; delay: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "absolute z-10 flex items-center gap-3 rounded-card bg-surface px-4 py-3 text-ink shadow-modal ring-1 ring-black/5 motion-safe:animate-float",
        className,
      )}
      style={{ animationDelay: delay }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- Proof strip

const PROOF = [
  { icon: Printer, title: "A4 · A5 · 80 mm · 58 mm", text: "Bills on any printer" },
  { icon: FileSpreadsheet, title: "GSTR-1 · GSTR-3B · Tally", text: "Reports ready to file" },
  { icon: Wallet, title: "Cash · UPI · Card · Pay later", text: "Split any way" },
  { icon: Building2, title: "Every branch", text: "One login for all shops" },
];

function ProofStrip() {
  return (
    <section className="border-b border-border bg-surface">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-px overflow-hidden bg-border sm:grid-cols-2 lg:grid-cols-4">
        {PROOF.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex items-center gap-3 bg-surface px-6 py-6">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-input bg-navy-50 text-navy-700">
              <Icon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{title}</p>
              <p className="text-helper text-slate">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Features (bento)

function SectionHeading({
  eyebrow,
  title,
  text,
  align = "center",
}: {
  eyebrow: string;
  title: ReactNode;
  text?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      <p className="eyebrow text-navy-600">{eyebrow}</p>
      <h2 className="mt-2 text-[1.875rem] leading-[2.375rem] font-bold tracking-[-0.02em] sm:text-[2.375rem] sm:leading-[2.875rem]">
        {title}
      </h2>
      {text && <p className="mt-4 text-card text-slate">{text}</p>}
    </div>
  );
}

function Tile({
  icon: Icon,
  title,
  text,
  className,
  children,
}: {
  icon: typeof Receipt;
  title: string;
  text: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "group flex flex-col overflow-hidden rounded-card border border-border bg-surface transition-shadow hover:shadow-menu",
        className,
      )}
    >
      <div className="p-6 pb-0">
        <span className="flex size-10 items-center justify-center rounded-input bg-navy-900 text-yellow-400">
          <Icon className="size-5" aria-hidden />
        </span>
        <h3 className="mt-4 text-section font-semibold">{title}</h3>
        <p className="mt-1.5 text-body text-slate">{text}</p>
      </div>
      <div className="mt-6 flex flex-1 items-end px-6 pb-6" aria-hidden>
        <div className="w-full">{children}</div>
      </div>
    </div>
  );
}

function Features() {
  return (
    <section id="features" className="scroll-mt-16 bg-canvas py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Features"
          title="Everything the counter needs. Nothing it doesn't."
          text="Built with shop owners and counter staff, so everyday jobs are quick and the tricky ones are safe."
        />

        <div className="mt-14 grid gap-4 lg:grid-cols-6">
          <Tile
            icon={ScanBarcode}
            title="Bill at the speed of your keyboard"
            text="Scan a barcode or type a few letters. Every common job has a key, so a bill takes seconds."
            className="lg:col-span-4"
          >
            <div className="flex flex-wrap gap-2">
              {[
                ["F3", "Search or scan"],
                ["F7", "Customer"],
                ["F9", "Discount"],
                ["F8", "Hold bill"],
                ["Alt+4", "Pay later"],
                ["F4", "Exact cash"],
                ["F12", "Charge"],
              ].map(([k, label]) => (
                <span
                  key={k}
                  className={cn(
                    "flex items-center gap-2 rounded-input border px-2.5 py-2 text-helper",
                    k === "F12"
                      ? "border-yellow-500 bg-yellow-50 text-yellow-700"
                      : "border-border bg-canvas text-slate",
                  )}
                >
                  <kbd className="rounded border border-b-2 border-border bg-surface px-1.5 py-0.5 font-sans text-overline font-bold text-ink">
                    {k}
                  </kbd>
                  {label}
                </span>
              ))}
            </div>
          </Tile>

          <Tile
            icon={Wallet}
            title="Know who owes what"
            text="Sell on Pay later with a limit and days to pay for each customer."
            className="lg:col-span-2"
          >
            <div className="rounded-input border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="text-body font-semibold">Kerala Cabs</p>
                <span className="rounded-full bg-warning-50 px-2 py-0.5 text-overline font-semibold text-warning">
                  Due in 3 days
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-navy-50">
                <div className="h-full w-[84%] rounded-full bg-navy-700" />
              </div>
              <div className="mt-2 flex justify-between text-overline text-slate">
                <span>Dues ₹8,400</span>
                <span>Can still owe ₹1,600</span>
              </div>
            </div>
          </Tile>

          <Tile
            icon={Receipt}
            title="Stock you can trust"
            text="Every sale, return and adjustment moves stock. See what's running low."
            className="lg:col-span-2"
          >
            <ul className="divide-y divide-border rounded-input border border-border text-helper">
              {[
                ["Brake pad set, front", "12 in stock", "text-success"],
                ["Clutch plate", "Only 2 left", "text-warning"],
                ["Air filter", "Out of stock", "text-danger"],
              ].map(([n, s, c]) => (
                <li key={n} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="truncate">{n}</span>
                  <span className={cn("shrink-0 font-semibold", c)}>{s}</span>
                </li>
              ))}
            </ul>
          </Tile>

          <Tile
            icon={FileSpreadsheet}
            title="GST reports, ready to file"
            text="GSTR-1, GSTR-3B and HSN summary for any period. Download Excel, the GSTR-1 portal JSON or a Tally file."
            className="lg:col-span-4"
          >
            <div className="overflow-hidden rounded-input border border-border">
              <div className="flex items-center justify-between bg-navy-50 px-3 py-2">
                <p className="text-helper font-semibold">GSTR-1 · This month</p>
                <div className="flex gap-1.5">
                  {["Excel", "Portal JSON", "Tally XML"].map((b) => (
                    <span
                      key={b}
                      className="rounded border border-border bg-surface px-2 py-0.5 text-overline font-semibold text-navy-700"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
              <table className="w-full text-helper">
                <tbody className="divide-y divide-border">
                  {[
                    ["B2B invoices", "₹3,84,200", "₹69,156"],
                    ["B2C (small)", "₹6,12,750", "₹1,10,295"],
                    ["Credit notes", "−₹18,400", "−₹3,312"],
                  ].map(([k, taxable, tax]) => (
                    <tr key={k}>
                      <td className="px-3 py-2 text-slate">{k}</td>
                      <td className="tabular px-3 py-2 text-right">{taxable}</td>
                      <td className="tabular px-3 py-2 text-right font-medium">{tax}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tile>

          <Tile
            icon={UserCheck}
            title="Staff with the right access"
            text="Owner, manager, counter, storekeeper and accountant roles. Big discounts need a manager's OK."
            className="lg:col-span-3"
          >
            <div className="rounded-input border border-yellow-500/40 bg-yellow-50 p-3">
              <p className="text-helper font-semibold text-yellow-700">Manager approval needed</p>
              <p className="mt-0.5 text-overline text-yellow-700/80">Discount above your 5% limit</p>
              <div className="mt-2.5 flex gap-2">
                <span className="h-8 flex-1 rounded-input border border-border bg-surface" />
                <span className="h-8 flex-1 rounded-input border border-border bg-surface" />
                <span className={buttonClasses("primary", "sm")}>Approve</span>
              </div>
            </div>
          </Tile>

          <Tile
            icon={Printer}
            title="Print the way you like"
            text="Tax invoices on A4 or A5, receipts on 80 mm or 58 mm, and barcode labels for your shelves."
            className="lg:col-span-3"
          >
            <div className="flex items-end justify-center gap-3">
              {[
                ["A4", "h-24 w-[68px]"],
                ["A5", "h-[68px] w-12"],
                ["80 mm", "h-20 w-9"],
                ["58 mm", "h-16 w-7"],
              ].map(([label, size]) => (
                <div key={label} className="flex flex-col items-center gap-1.5">
                  <div className={cn("rounded-sm border border-border bg-surface p-1.5 shadow-sm", size)}>
                    <div className="h-1 w-3/4 rounded bg-navy-700/70" />
                    <div className="mt-1 h-0.5 w-full rounded bg-border" />
                    <div className="mt-0.5 h-0.5 w-5/6 rounded bg-border" />
                    <div className="mt-0.5 h-0.5 w-2/3 rounded bg-border" />
                  </div>
                  <span className="text-overline font-semibold text-slate">{label}</span>
                </div>
              ))}
            </div>
          </Tile>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Steps

const STEPS = [
  {
    title: "Sign up your shop",
    text: "Enter your business name, city and your mobile number. Add your GSTIN now or later.",
  },
  { title: "We approve it", text: "We check new shops, usually within a day, and email you when you can log in." },
  {
    title: "Add items and start billing",
    text: "Import your item list and opening stock from a CSV file, open a shift and make your first bill.",
  },
];

function Steps() {
  return (
    <section id="how-it-works" className="scroll-mt-16 bg-surface py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="How it works" title="Up and running in a day" />
        <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-6">
          <div
            className="absolute top-5 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-yellow-500 via-navy-100 to-yellow-500 md:block"
            aria-hidden
          />
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative text-center">
              <span className="relative mx-auto flex size-10 items-center justify-center rounded-full bg-yellow-500 text-card font-bold text-navy-900 ring-8 ring-surface">
                {i + 1}
              </span>
              <h3 className="mt-5 text-section font-semibold">{s.title}</h3>
              <p className="mx-auto mt-2 max-w-xs text-body text-slate">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- FAQ

const FAQS = [
  {
    q: "Do I need to install anything?",
    a: "No. It runs in the browser on any computer, tablet or phone. You need an internet connection while you bill.",
  },
  {
    q: "Is my data private?",
    a: "Yes. Each business's data is kept completely separate, and your staff only see the branches you give them.",
  },
  {
    q: "Can I use it in more than one branch?",
    a: "Yes. Every branch has its own stock, bills and bill numbers, and you can see them together in reports.",
  },
  {
    q: "Which printers work?",
    a: "Any printer your computer can print to: a normal A4/A5 printer or an 80 mm / 58 mm thermal receipt printer.",
  },
  {
    q: "Can I bring my old customer dues?",
    a: "Yes. Enter each customer's old dues once. They show with their new bills until they're paid.",
  },
  {
    q: "What if a customer returns a part?",
    a: "Make a credit note from the bill. The part goes back to stock and the customer's balance or refund is worked out.",
  },
];

function Faq() {
  return (
    <section id="faq" className="scroll-mt-16 bg-surface py-20 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-16">
        <div>
          <SectionHeading
            align="left"
            eyebrow="Questions"
            title="Good to know"
            text="Can't find your answer? Book a quick demo and ask us anything."
          />
          <a href="#demo" className={buttonClasses("outline", "md", "mt-6")}>
            <CalendarCheck className="size-4" aria-hidden /> Book a quick demo
          </a>
        </div>
        <div className="divide-y divide-border rounded-card border border-border bg-surface">
          {FAQS.map((f) => (
            <details key={f.q} className="group px-5 py-1 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold">
                {f.q}
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-navy-50 text-card text-navy-700 transition-transform group-open:rotate-45"
                  aria-hidden
                >
                  +
                </span>
              </summary>
              <p className="pb-4 text-body text-slate">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Closing CTA, footer

function ClosingCta() {
  return (
    <section className="bg-surface px-4 py-20 sm:px-6 sm:py-24">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[20px] bg-navy-900 px-6 py-14 text-center text-white sm:px-12 sm:py-16">
        <DotGrid id="cta-dots" className="opacity-[0.06]" />
        <div className="pointer-events-none absolute -top-24 -right-16 size-80 rounded-full bg-yellow-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full bg-navy-600/50 blur-3xl" />
        <ShieldCheck className="relative mx-auto size-10 text-yellow-400" aria-hidden />
        <h2 className="relative mt-4 text-[1.875rem] leading-[2.375rem] font-bold tracking-[-0.02em] sm:text-[2.5rem] sm:leading-[3rem]">
          Your next bill could be on {APP_NAME}.
        </h2>
        <p className="relative mx-auto mt-3 max-w-xl text-card text-white/70">
          Sign up your shop today. Once it's approved, you can start billing straight away.
        </p>
        <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/register" className={buttonClasses("accent", "lg")}>
            Start free <ArrowRight className="size-5" aria-hidden />
          </Link>
          <a
            href="#demo"
            className={buttonClasses("outline", "lg", "border-white/25 bg-transparent text-white hover:bg-white/10")}
          >
            Book a quick demo
          </a>
          {CONTACT_EMAIL && (
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className={buttonClasses("ghost", "lg", "text-white hover:bg-white/10")}
            >
              Contact us
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xs">
          <div className="flex items-center gap-2.5">
            <Logo className="size-8" />
            <span className="text-card font-bold">{APP_NAME}</span>
          </div>
          <p className="mt-3 text-helper text-slate">
            GST billing, stock and customer dues for auto parts shops across India.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 text-helper sm:grid-cols-3">
          <FooterCol title="Product">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#faq">Questions</a>
          </FooterCol>
          <FooterCol title="Get started">
            <Link to="/register">Sign up</Link>
            <Link to="/login">Log in</Link>
            <a href="#demo">Book a demo</a>
          </FooterCol>
          {CONTACT_EMAIL && (
            <FooterCol title="Contact">
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </FooterCol>
          )}
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-5 text-helper text-muted sm:px-6">
          © {YEAR} {APP_NAME}. Each business's data is kept separate and private.
        </p>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="eyebrow text-ink">{title}</p>
      <div className="mt-3 flex flex-col gap-2 text-slate [&_a:hover]:text-ink">{children}</div>
    </div>
  );
}

// Phones: the two main actions stay one tap away.
function MobileCtaBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:hidden">
      <div className="grid grid-cols-2 gap-2">
        <a href="#demo" className={buttonClasses("outline", "md")}>
          Book a demo
        </a>
        <Link to="/register" className={buttonClasses("accent", "md")}>
          Start free
        </Link>
      </div>
    </div>
  );
}
