import { Fragment, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Lightbulb, Search, X } from "lucide-react";
import { PageHeader } from "@/components/ui/Controls";
import { Kbd } from "@/components/ui/Kbd";
import { NoResults } from "@/components/ui/States";
import { APP_NAME } from "@/lib/brand";
import { HELP, type HelpArticle, type HelpBlock, type HelpSection } from "./help-content";

// The user manual. Content lives in help-content.ts; this page only lays it out and searches it.
export function HelpPage() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const sections = useMemo(() => {
    if (!q) return HELP;
    return HELP.map((s) => ({
      ...s,
      articles: s.articles.filter((a) => articleText(s, a).includes(q)),
    })).filter((s) => s.articles.length > 0);
  }, [q]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Help" description={`How to use ${APP_NAME}: billing, dues, stock, reports and settings.`} />

      <div className="relative mb-6 max-w-xl">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-slate" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help, e.g. pay later, return, GSTR-1"
          aria-label="Search help"
          className="h-10 w-full rounded-input border border-border bg-surface pr-9 pl-10 text-body outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-600/20"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded text-slate hover:bg-navy-50"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Help topics" className="hidden lg:block">
          <ul className="sticky top-4 space-y-0.5">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="block rounded-input px-3 py-2 text-body text-slate hover:bg-navy-50 hover:text-ink"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-10">
          {sections.length === 0 && (
            <NoResults
              query={query}
              hint="Try another word, such as bill, dues, stock or print."
              onClear={() => setQuery("")}
            />
          )}
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-4">
              <h2 className="text-section font-semibold text-ink">{s.title}</h2>
              <p className="mt-1 text-body text-slate">
                <Rich text={s.intro} />
                {s.who && <span className="ml-2 text-helper text-muted">· Usually done by: {s.who}</span>}
              </p>
              <div className="mt-4 space-y-3">
                {s.articles.map((a) => (
                  <article
                    key={a.id}
                    id={`${s.id}-${a.id}`}
                    className="rounded-card border border-border bg-surface p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-card font-semibold text-ink">{a.title}</h3>
                      {a.who && (
                        <span className="rounded-full bg-navy-50 px-2 py-0.5 text-overline font-semibold text-navy-700">
                          {a.who}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 space-y-3">
                      {a.blocks.map((b, i) => (
                        <Block key={i} block={b} />
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function Block({ block }: { block: HelpBlock }) {
  switch (block.type) {
    case "p":
      return (
        <p className="text-body text-ink">
          <Rich text={block.text} />
        </p>
      );
    case "steps":
      return (
        <ol className="space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-body text-ink">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-navy-50 text-overline font-semibold text-navy-700">
                {i + 1}
              </span>
              <span className="pt-0.5">
                <Rich text={item} />
              </span>
            </li>
          ))}
        </ol>
      );
    case "list":
      return (
        <ul className="list-disc space-y-1.5 pl-5 text-body text-ink marker:text-muted">
          {block.items.map((item, i) => (
            <li key={i}>
              <Rich text={item} />
            </li>
          ))}
        </ul>
      );
    case "tip":
    case "warn": {
      const tip = block.type === "tip";
      const Icon = tip ? Lightbulb : AlertTriangle;
      return (
        <div
          className={
            tip
              ? "flex gap-2.5 rounded-input bg-yellow-50 p-3 text-body text-yellow-700"
              : "flex gap-2.5 rounded-input bg-warning-50 p-3 text-body text-warning"
          }
        >
          <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <Rich text={block.text} />
          </p>
        </div>
      );
    }
    case "table":
      return (
        <div className="overflow-x-auto rounded-input border border-border">
          <table className="w-full text-left text-body">
            <thead className="bg-navy-50">
              <tr>
                {block.head.map((h) => (
                  <th key={h} className="eyebrow px-3 py-2 text-slate">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className={j === 0 ? "px-3 py-2 align-top font-medium whitespace-nowrap" : "px-3 py-2"}>
                      <Rich text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

// Renders **bold** and `key` marks.
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i): ReactNode => {
        if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith("`") && p.endsWith("`")) return <Kbd key={i}>{p.slice(1, -1)}</Kbd>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

function articleText(section: HelpSection, article: HelpArticle): string {
  const blockText = article.blocks.map((b) =>
    "text" in b ? b.text : "items" in b ? b.items.join(" ") : [...b.head, ...b.rows.flat()].join(" "),
  );
  return [section.title, article.title, ...blockText].join(" ").replace(/[*`]/g, "").toLowerCase();
}
