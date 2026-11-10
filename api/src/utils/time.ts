// True when `timeZone` is an IANA zone name the runtime knows (e.g. "Asia/Kolkata").
export function isValidTimeZone(timeZone: string) {
  try {
    return Boolean(new Intl.DateTimeFormat("en-US", { timeZone }).resolvedOptions().timeZone);
  } catch {
    return false;
  }
}

// Offset of `timeZone` from UTC at `at`, in milliseconds (IST = +19 800 000).
function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

// The instant a calendar day ("2026-11-09") starts in `timeZone`. Used for date-range filters,
// so "today" means the business's day, not the server's or UTC.
export function startOfDayIn(day: string, timeZone: string): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d);
  return new Date(guess - zoneOffsetMs(new Date(guess), timeZone));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

// Last instant of the calendar day `days` after `from`, in `timeZone`. A due date with 0 credit days is
// "end of today", so a bill doesn't read as overdue the moment it's saved.
export function endOfDayAfter(from: Date, days: number, timeZone: string): Date {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(from);
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + days + 1)).toISOString().slice(0, 10);
  return new Date(startOfDayIn(next, timeZone).getTime() - 1);
}
