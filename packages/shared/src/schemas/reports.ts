import { z } from "zod";

// ---------- Dashboard ----------

export const DASHBOARD_RANGES = ["today", "7d", "30d"] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

export const DASHBOARD_RANGE_DAYS: Record<DashboardRange, number> = { today: 1, "7d": 7, "30d": 30 };

export const DASHBOARD_RANGE_LABELS: Record<DashboardRange, string> = {
  today: "Today",
  "7d": "7 days",
  "30d": "30 days",
};

// ---------- Reports ----------

export const REPORT_NAMES = [
  "sales-register",
  "day-book",
  "shift",
  "gstr1",
  "gstr3b",
  "hsn-summary",
  "receivables-ageing",
  "stock-valuation",
  "stock-movement",
] as const;
export type ReportName = (typeof REPORT_NAMES)[number];

export const SALES_GROUP_BYS = ["invoice", "day", "customer", "item", "category", "mode"] as const;
export type SalesGroupBy = (typeof SALES_GROUP_BYS)[number];

export const SALES_GROUP_BY_LABELS: Record<SalesGroupBy, string> = {
  invoice: "Invoice",
  day: "Day",
  customer: "Customer",
  item: "Item",
  category: "Category",
  mode: "Payment mode",
};

export const REPORT_GROUPS = ["Sales", "GST", "Stock"] as const;
export type ReportGroup = (typeof REPORT_GROUPS)[number];

export interface ReportDefinition {
  name: ReportName;
  title: string;
  description: string;
  group: ReportGroup;
  // false: a snapshot as of now (ageing, valuation); the date range is ignored.
  dated: boolean;
}

export const REPORTS: readonly ReportDefinition[] = [
  {
    name: "sales-register",
    title: "Sales register",
    description: "Invoices in the period, or totals by day, customer, item, category or payment mode.",
    group: "Sales",
    dated: true,
  },
  {
    name: "day-book",
    title: "Day book",
    description: "Every invoice, receipt, refund and credit note in order.",
    group: "Sales",
    dated: true,
  },
  {
    name: "shift",
    title: "Shift report",
    description: "Counter shifts opened in the period: sales, expected and counted cash, variance.",
    group: "Sales",
    dated: true,
  },
  {
    name: "receivables-ageing",
    title: "Receivables ageing",
    description: "What each customer owes today, by days past the due date.",
    group: "Sales",
    dated: false,
  },
  {
    name: "gstr1",
    title: "GSTR-1",
    description: "Outward supplies: B2B, B2C large and small, credit notes and HSN summary. Portal JSON download.",
    group: "GST",
    dated: true,
  },
  {
    name: "gstr3b",
    title: "GSTR-3B summary",
    description: "Output tax on sales net of credit notes (take input tax credit from GSTR-2B).",
    group: "GST",
    dated: true,
  },
  {
    name: "hsn-summary",
    title: "HSN / SAC summary",
    description: "Quantity, taxable value and tax per HSN/SAC code and rate, net of credit notes.",
    group: "GST",
    dated: true,
  },
  {
    name: "stock-valuation",
    title: "Stock valuation",
    description: "On-hand quantity at purchase and sale price, with days since the last sale (slow movers).",
    group: "Stock",
    dated: false,
  },
  {
    name: "stock-movement",
    title: "Stock movement",
    description: "Opening, inward, outward and closing quantity per item in the period.",
    group: "Stock",
    dated: true,
  },
];

export const reportDefinition = (name: string): ReportDefinition | undefined => REPORTS.find((r) => r.name === name);

export const REPORT_FORMATS = ["json", "csv", "xlsx"] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

// Shared by every report. from/to are calendar days in the app timezone, both inclusive.
export const reportQuerySchema = z
  .object({
    from: day.optional(),
    to: day.optional(),
    // Defaults to the x-branch-id header; "all" = every branch the user can access.
    branchId: z.union([z.uuid(), z.literal("all")]).optional(),
    // "portal" is GSTR-1 only: the JSON file for the GST offline tool.
    format: z.enum([...REPORT_FORMATS, "portal"]).default("json"),
    groupBy: z.enum(SALES_GROUP_BYS).default("invoice"),
    customerId: z.uuid().optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: "From must be on or before To", path: ["from"] });
export type ReportQuery = z.output<typeof reportQuerySchema>;

export const TALLY_VOUCHER_KINDS = ["sales", "payments"] as const;
export type TallyVoucherKind = (typeof TALLY_VOUCHER_KINDS)[number];

export const tallyExportQuerySchema = z
  .object({
    from: day.optional(),
    to: day.optional(),
    branchId: z.union([z.uuid(), z.literal("all")]).optional(),
    // Comma-separated; default all three.
    vouchers: z
      .string()
      .optional()
      .transform((v, ctx) => {
        const kinds = (v ?? TALLY_VOUCHER_KINDS.join(","))
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const bad = kinds.filter((k) => !(TALLY_VOUCHER_KINDS as readonly string[]).includes(k));
        if (bad.length || !kinds.length) {
          ctx.addIssue({ code: "custom", message: `Use ${TALLY_VOUCHER_KINDS.join(", ")}` });
          return z.NEVER;
        }
        return [...new Set(kinds)] as TallyVoucherKind[];
      }),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: "From must be on or before To", path: ["from"] });
export type TallyExportQuery = z.output<typeof tallyExportQuerySchema>;

// Longest period a dated report accepts.
export const REPORT_MAX_DAYS = 366;

// ---------- Report result (generic table, rendered by the UI and written to CSV / Excel) ----------

export type ReportColumnType = "text" | "date" | "datetime" | "money" | "qty" | "int" | "percent";

export interface ReportColumn {
  key: string;
  label: string;
  type: ReportColumnType;
}

// Money is a 2-decimal string, quantity a 3-decimal string, dates ISO strings.
export type ReportCell = string | number | null;

export interface ReportTable {
  key: string;
  title?: string;
  columns: ReportColumn[];
  rows: Record<string, ReportCell>[];
  totals?: Record<string, ReportCell>;
}

export interface ReportResult {
  name: ReportName;
  title: string;
  // null for snapshot reports.
  from: string | null;
  to: string | null;
  asOf: string;
  scope: { branchIds: string[]; label: string };
  tables: ReportTable[];
  notes: string[];
}

// GST unit quantity codes (UQC) for the item units.
export const UQC_BY_UNIT: Record<string, string> = {
  PCS: "PCS",
  SET: "SET",
  PAIR: "PRS",
  KIT: "OTH",
  LTR: "LTR",
  ML: "MLT",
  KG: "KGS",
  GM: "GMS",
  MTR: "MTR",
  ROLL: "ROL",
  BOX: "BOX",
};

// B2C invoices above this value to another state are "B2C large" in GSTR-1 (₹1 lakh from August 2024).
export const B2CL_THRESHOLD_PAISE = 1_00_000_00;

// Overdue buckets for the receivables (customers' dues) ageing, by days past the due date.
export const AGEING_BUCKETS = [
  { key: "current", label: "Not yet due", min: -Infinity, max: 0 },
  { key: "d1_30", label: "1–30 days", min: 1, max: 30 },
  { key: "d31_60", label: "31–60 days", min: 31, max: 60 },
  { key: "d61_90", label: "61–90 days", min: 61, max: 90 },
  { key: "d90_plus", label: "Over 90 days", min: 91, max: Infinity },
] as const;
export type AgeingBucket = (typeof AGEING_BUCKETS)[number]["key"];

export const ageingBucket = (daysOverdue: number): AgeingBucket =>
  AGEING_BUCKETS.find((b) => daysOverdue >= b.min && daysOverdue <= b.max)!.key;
