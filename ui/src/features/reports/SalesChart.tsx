import { formatINR } from "@erp-software/shared";
import { cn } from "@/lib/utils";

interface Day {
  date: string;
  bills: number;
  parts: string;
  labour: string;
  total: string;
}

const longDay = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const parse = (d: string) => new Date(`${d}T00:00:00Z`);

// Round the axis maximum up to 1, 2 or 5 × 10^n so gridline labels read cleanly.
function niceMax(v: number) {
  if (v <= 0) return 1000;
  const pow = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 5, 10].find((m) => m * pow >= v) ?? 10) * pow;
}

const compact = (v: number) =>
  v >= 1_00_000
    ? `₹${(v / 1_00_000).toFixed(v % 1_00_000 ? 1 : 0)}L`
    : v >= 1000
      ? `₹${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k`
      : `₹${v}`;

// Stacked bars per the design system: Parts navy-700 at the bottom, Labour yellow-500 on top;
// the last bar (today) uses navy-600 for parts.
export function SalesChart({ days }: { days: Day[] }) {
  const max = niceMax(Math.max(...days.map((d) => Number(d.total)), 0));
  const empty = days.every((d) => Number(d.total) === 0);
  const ticks = [max, max / 2, 0];

  return (
    <figure aria-label="Sales for the last 14 days, parts and labour" className="relative">
      <div className="flex h-56 gap-3">
        <div className="flex w-12 flex-col justify-between pb-6 text-right text-[12px] text-slate tabular" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {compact(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between" aria-hidden>
            {ticks.map((t) => (
              <div key={t} className="border-t border-border" />
            ))}
          </div>
          <ol className="relative flex h-full items-end gap-1.5 sm:gap-2.5">
            {days.map((d, i) => {
              const parts = Number(d.parts);
              const labour = Number(d.labour);
              const today = i === days.length - 1;
              const label = `${longDay.format(parse(d.date))}: ${formatINR(d.total)} (parts ${formatINR(parts)}, labour ${formatINR(labour)}), ${d.bills} bill${d.bills === 1 ? "" : "s"}`;
              return (
                <li
                  key={d.date}
                  className="flex h-full min-w-0 flex-1 flex-col items-center"
                  title={label}
                  aria-label={label}
                >
                  <div className="flex w-full max-w-9 flex-1 flex-col justify-end pb-px">
                    {labour > 0 && (
                      <div
                        className="w-full rounded-t-[3px] bg-yellow-500"
                        style={{ height: `${(labour / max) * 100}%` }}
                      />
                    )}
                    {parts > 0 && (
                      <div
                        className={cn(
                          "w-full",
                          labour > 0 ? "" : "rounded-t-[3px]",
                          today ? "bg-navy-600" : "bg-navy-700",
                        )}
                        style={{ height: `${(parts / max) * 100}%` }}
                      />
                    )}
                  </div>
                  <span
                    className={cn(
                      "mt-1.5 h-[18px] text-[12px] leading-[18px] text-slate",
                      today && "font-semibold text-ink",
                    )}
                  >
                    {today ? "Today" : parse(d.date).getUTCDate()}
                  </span>
                </li>
              );
            })}
          </ol>
          {empty && (
            <p className="absolute inset-x-0 top-1/3 text-center text-body text-slate">No sales in the last 14 days</p>
          )}
        </div>
      </div>
    </figure>
  );
}
