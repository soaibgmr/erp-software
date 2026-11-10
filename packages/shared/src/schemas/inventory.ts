import { z } from "zod";
import { GST_RATES } from "../gst.js";
import { optionalText, patchOf, requiredText } from "./common.js";

// ---------- Field building blocks ----------

export const ITEM_UNITS = ["PCS", "SET", "PAIR", "KIT", "LTR", "ML", "KG", "GM", "MTR", "ROLL", "BOX"] as const;
export type ItemUnit = (typeof ITEM_UNITS)[number];

export const ITEM_UNIT_LABELS: Record<ItemUnit, string> = {
  PCS: "Pieces",
  SET: "Set",
  PAIR: "Pair",
  KIT: "Kit",
  LTR: "Litre",
  ML: "Millilitre",
  KG: "Kilogram",
  GM: "Gram",
  MTR: "Metre",
  ROLL: "Roll",
  BOX: "Box",
};

const MAX_MONEY = 99_999_999.99;
const MAX_QTY = 99_999_999;

export const gstRateSchema = z.coerce
  .number()
  .refine((r) => (GST_RATES as readonly number[]).includes(r), "Choose a GST slab");

export const moneySchema = z.coerce
  .number()
  .min(0, "Can't be negative")
  .max(MAX_MONEY)
  .multipleOf(0.01, "At most 2 decimals");

// "" from an empty input means "not set".
export const optionalMoneySchema = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  moneySchema.nullable(),
);

export const quantitySchema = z.coerce.number().max(MAX_QTY).min(-MAX_QTY).multipleOf(0.001, "At most 3 decimals");
export const positiveQuantitySchema = quantitySchema.refine((q) => q > 0, "Must be more than 0");
export const nonNegativeQuantitySchema = quantitySchema.refine((q) => q >= 0, "Can't be negative");

const optionalUuid = z.preprocess((v) => (v === "" ? null : v), z.uuid().nullable().optional());

export const hsnSacCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{4,8}$/, "4–8 digits");

const optionalHsnSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4,8}$/.test(v), "4–8 digits")
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

export const skuSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, "Required")
  .max(40)
  .regex(/^[A-Z0-9][A-Z0-9\-_/.]*$/, "Letters, digits and - _ / . only");

export const barcodeSchema = z
  .string()
  .trim()
  .min(3, "At least 3 characters")
  .max(64)
  .regex(/^[\x21-\x7E]+$/, "No spaces or special characters");

// ---------- Catalog masters ----------

export const categoryCreateSchema = z.strictObject({
  name: requiredText(80),
  description: optionalText(200),
});
export const categoryUpdateSchema = patchOf(categoryCreateSchema);

export const brandCreateSchema = z.strictObject({ name: requiredText(80) });
export const brandUpdateSchema = patchOf(brandCreateSchema);

export const HSN_SAC_KINDS = ["HSN", "SAC"] as const;
export type HsnSacKind = (typeof HSN_SAC_KINDS)[number];

export const hsnSacCreateSchema = z.strictObject({
  code: hsnSacCodeSchema,
  kind: z.enum(HSN_SAC_KINDS).default("HSN"),
  description: requiredText(300),
  gstRate: gstRateSchema,
});
export const hsnSacUpdateSchema = patchOf(hsnSacCreateSchema);

export const vehicleMakeCreateSchema = z.strictObject({ name: requiredText(60) });
export const vehicleMakeUpdateSchema = patchOf(vehicleMakeCreateSchema);

export const vehicleModelCreateSchema = z.strictObject({
  makeId: z.uuid("Choose a make"),
  name: requiredText(80),
});
export const vehicleModelUpdateSchema = patchOf(vehicleModelCreateSchema);

// ---------- Items ----------

export const itemBaseSchema = z.strictObject({
  sku: skuSchema,
  name: requiredText(200),
  oemPartNo: optionalText(60),
  description: optionalText(500),
  categoryId: optionalUuid,
  brandId: optionalUuid,
  hsnCode: optionalHsnSchema,
  gstRate: gstRateSchema.default(18),
  unit: z.enum(ITEM_UNITS).default("PCS"),
  mrp: optionalMoneySchema.optional(),
  salePrice: moneySchema,
  purchasePrice: moneySchema.default(0),
  // Sale price already includes GST (typical for MRP items).
  taxInclusive: z.boolean().default(false),
  isActive: z.boolean().default(true),
  barcodes: z.array(barcodeSchema).max(10, "At most 10 barcodes").default([]),
  compatibleModelIds: z.array(z.uuid()).max(300).default([]),
});

export interface ItemRuleInput {
  salePrice: number;
  mrp?: number | null;
  gstRate: number;
  taxInclusive: boolean;
  barcodes?: string[];
}

// Selling price including GST, in paise-free rupees rounded to 2 places.
export function priceWithTax(salePrice: number, gstRate: number, taxInclusive: boolean): number {
  return taxInclusive ? salePrice : Math.round(salePrice * (100 + gstRate)) / 100;
}

export function itemRuleIssues(i: ItemRuleInput): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  if (i.mrp != null && i.mrp > 0) {
    const gross = priceWithTax(i.salePrice, i.gstRate, i.taxInclusive);
    if (gross > i.mrp) {
      issues.push({ path: "salePrice", message: `Price with GST (₹${gross.toFixed(2)}) is above the MRP` });
    }
  }
  if (i.barcodes && new Set(i.barcodes).size !== i.barcodes.length) {
    issues.push({ path: "barcodes", message: "The same barcode is listed twice" });
  }
  return issues;
}

export const itemCreateSchema = itemBaseSchema.superRefine((i, ctx) => {
  for (const issue of itemRuleIssues({ ...i, mrp: i.mrp ?? null })) {
    ctx.addIssue({ code: "custom", path: [issue.path], message: issue.message });
  }
});
export const itemUpdateSchema = patchOf(itemBaseSchema);

export type ItemCreateInput = z.input<typeof itemCreateSchema>;
export type ItemCreate = z.output<typeof itemCreateSchema>;
export type ItemUpdate = z.output<typeof itemUpdateSchema>;

// ---------- Labour services ----------

export const labourServiceCreateSchema = z.strictObject({
  code: optionalText(20),
  name: requiredText(150),
  sacCode: hsnSacCodeSchema.default("998714"),
  gstRate: gstRateSchema.default(18),
  rate: moneySchema,
  standardHours: z.coerce.number().min(0).max(999).multipleOf(0.01, "At most 2 decimals").default(0),
  isActive: z.boolean().default(true),
});
export const labourServiceUpdateSchema = patchOf(labourServiceCreateSchema);

export type LabourServiceCreate = z.output<typeof labourServiceCreateSchema>;
export type LabourServiceUpdate = z.output<typeof labourServiceUpdateSchema>;

// ---------- Stock ----------

// Every change to on-hand quantity is one of these ledger movement types.
export const STOCK_MOVEMENT_TYPES = [
  "OPENING",
  "ADJUSTMENT",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "TRANSFER_CANCEL",
  "SALE",
  "SALE_CANCEL",
  "SALE_RETURN",
  "PURCHASE", // history only: purchasing was removed (2026-11-10)
  "PURCHASE_RETURN",
] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  OPENING: "Opening stock",
  ADJUSTMENT: "Adjustment",
  TRANSFER_OUT: "Transfer out",
  TRANSFER_IN: "Transfer in",
  TRANSFER_CANCEL: "Transfer cancelled",
  SALE: "Sale",
  SALE_CANCEL: "Sale cancelled",
  SALE_RETURN: "Sale return",
  PURCHASE: "Purchase receipt",
  PURCHASE_RETURN: "Purchase return",
};

export const stockSettingsSchema = z.strictObject({
  minLevel: nonNegativeQuantitySchema.optional(),
  reorderQty: nonNegativeQuantitySchema.optional(),
  binLocation: optionalText(30),
});
export type StockSettingsUpdate = z.output<typeof stockSettingsSchema>;

export const STOCK_ADJUSTMENT_REASONS = ["COUNT_CORRECTION", "DAMAGE", "EXPIRY", "OPENING_STOCK", "OTHER"] as const;
export type StockAdjustmentReason = (typeof STOCK_ADJUSTMENT_REASONS)[number];

export const STOCK_ADJUSTMENT_REASON_LABELS: Record<StockAdjustmentReason, string> = {
  COUNT_CORRECTION: "Count correction",
  DAMAGE: "Damaged",
  EXPIRY: "Expired",
  OPENING_STOCK: "Opening stock",
  OTHER: "Other",
};

export const STOCK_ADJUSTMENT_STATUSES = ["PENDING", "POSTED", "REJECTED"] as const;
export type StockAdjustmentStatus = (typeof STOCK_ADJUSTMENT_STATUSES)[number];

const uniqueItems = (lines: { itemId: string }[]) => new Set(lines.map((l) => l.itemId)).size === lines.length;

export const stockAdjustmentCreateSchema = z
  .strictObject({
    reason: z.enum(STOCK_ADJUSTMENT_REASONS),
    note: optionalText(300),
    lines: z
      .array(
        z.strictObject({
          itemId: z.uuid(),
          // Signed: +3 adds three to on hand, −2 removes two.
          quantity: quantitySchema.refine((q) => q !== 0, "Enter a quantity other than 0"),
        }),
      )
      .min(1, "Add at least one item")
      .max(200)
      .refine(uniqueItems, "Each item can appear only once"),
  })
  .superRefine((a, ctx) => {
    if (a.reason === "OTHER" && !a.note)
      ctx.addIssue({ code: "custom", path: ["note"], message: "Explain the reason" });
  });
export type StockAdjustmentCreate = z.output<typeof stockAdjustmentCreateSchema>;

export const stockAdjustmentRejectSchema = z.strictObject({ note: optionalText(300) });

export const STOCK_TRANSFER_STATUSES = ["IN_TRANSIT", "RECEIVED", "CANCELLED"] as const;
export type StockTransferStatus = (typeof STOCK_TRANSFER_STATUSES)[number];

export const stockTransferCreateSchema = z.strictObject({
  toBranchId: z.uuid("Choose the receiving branch"),
  note: optionalText(300),
  lines: z
    .array(z.strictObject({ itemId: z.uuid(), quantity: positiveQuantitySchema }))
    .min(1, "Add at least one item")
    .max(200)
    .refine(uniqueItems, "Each item can appear only once"),
});
export type StockTransferCreate = z.output<typeof stockTransferCreateSchema>;

// ---------- Import (items + opening stock) ----------

// Column order of the import template; header names are matched case-insensitively.
export const ITEM_IMPORT_COLUMNS = [
  "sku",
  "name",
  "brand",
  "category",
  "oemPartNo",
  "barcode",
  "hsnCode",
  "gstRate",
  "unit",
  "mrp",
  "salePrice",
  "purchasePrice",
  "taxInclusive",
  "openingQty",
  "minLevel",
  "reorderQty",
  "binLocation",
] as const;
export type ItemImportColumn = (typeof ITEM_IMPORT_COLUMNS)[number];

const csvBool = z
  .string()
  .trim()
  .toLowerCase()
  .refine((v) => ["", "yes", "no", "true", "false", "y", "n", "1", "0"].includes(v), "Use yes or no")
  .transform((v) => ["yes", "true", "y", "1"].includes(v));

// Empty cell -> fallback (undefined makes the column required); "1,250" -> "1250".
const csvNumber = <T extends z.ZodType>(schema: T, fallback: number | null | undefined) =>
  z.preprocess(
    (v) =>
      v === undefined || (typeof v === "string" && v.trim() === "")
        ? fallback
        : typeof v === "string"
          ? v.replace(/,/g, "")
          : v,
    schema,
  );

// One CSV row: every cell arrives as a string.
export const itemImportRowSchema = z
  .object({
    sku: skuSchema,
    name: requiredText(200),
    brand: optionalText(80),
    category: optionalText(80),
    oemPartNo: optionalText(60),
    barcode: z
      .string()
      .trim()
      .refine((v) => v === "" || barcodeSchema.safeParse(v).success, "Barcode: 3–64 characters, no spaces")
      .transform((v) => (v === "" ? null : v))
      .optional(),
    hsnCode: optionalHsnSchema,
    gstRate: csvNumber(gstRateSchema, 18),
    unit: z.preprocess(
      (v) => (typeof v === "string" && v.trim() !== "" ? v.trim().toUpperCase() : "PCS"),
      z.enum(ITEM_UNITS, `Unit must be one of ${ITEM_UNITS.join(", ")}`),
    ),
    mrp: csvNumber(moneySchema.nullable(), null),
    salePrice: csvNumber(moneySchema, undefined),
    purchasePrice: csvNumber(moneySchema, 0),
    taxInclusive: csvBool.optional().default(false),
    openingQty: csvNumber(nonNegativeQuantitySchema, 0),
    minLevel: csvNumber(nonNegativeQuantitySchema, 0),
    reorderQty: csvNumber(nonNegativeQuantitySchema, 0),
    binLocation: optionalText(30),
  })
  .superRefine((r, ctx) => {
    for (const issue of itemRuleIssues({
      salePrice: r.salePrice,
      mrp: r.mrp,
      gstRate: r.gstRate,
      taxInclusive: r.taxInclusive,
    })) {
      ctx.addIssue({ code: "custom", path: [issue.path], message: issue.message });
    }
  });
export type ItemImportRow = z.output<typeof itemImportRowSchema>;

export const MAX_IMPORT_ROWS = 2000;

export const stockImportSchema = z.strictObject({
  // false = validate and report only; true = write items and opening stock.
  commit: z.boolean().default(false),
  // Existing SKUs: update their master data (true) or leave them untouched (false).
  updateExisting: z.boolean().default(false),
  rows: z
    .array(z.record(z.string(), z.string()))
    .min(1, "The file has no rows")
    .max(MAX_IMPORT_ROWS, `At most ${MAX_IMPORT_ROWS} rows per file`),
});
export type StockImportInput = z.output<typeof stockImportSchema>;
