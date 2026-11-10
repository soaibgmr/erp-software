// Calendar days in the business timezone, as the API expects (YYYY-MM-DD).
const TZ = "Asia/Kolkata";

export const today = (offsetDays = 0) =>
  new Date(Date.now() - offsetDays * 86_400_000).toLocaleDateString("en-CA", { timeZone: TZ });

export const monthStart = (day = today()) => `${day.slice(0, 8)}01`;

const shift = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export const lastMonth = (): [string, string] => {
  const end = shift(monthStart(), -1);
  return [monthStart(end), end];
};

// Indian financial year (April–March) containing `day`.
export const financialYear = (day = today()): [string, string] => {
  const y = Number(day.slice(0, 4));
  const start = Number(day.slice(5, 7)) >= 4 ? y : y - 1;
  return [`${start}-04-01`, day];
};

export const PERIOD_PRESETS: { key: string; label: string; range: () => [string, string] }[] = [
  { key: "today", label: "Today", range: () => [today(), today()] },
  { key: "7d", label: "Last 7 days", range: () => [today(6), today()] },
  { key: "month", label: "This month", range: () => [monthStart(), today()] },
  { key: "last-month", label: "Last month", range: lastMonth },
  { key: "fy", label: "This financial year", range: financialYear },
];
