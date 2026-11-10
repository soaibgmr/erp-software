import { z } from "zod";
import { GST_RATES } from "../gst.js";
import { optionalText } from "./common.js";

export const SETTINGS_GROUPS = ["tax", "print", "pos", "inventory"] as const;
export type SettingsGroup = (typeof SETTINGS_GROUPS)[number];

export const PAYMENT_MODES = ["CASH", "UPI", "CARD", "CREDIT"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const taxSettingsSchema = z.strictObject({
  defaultGstRate: z.coerce
    .number()
    .refine((r) => (GST_RATES as readonly number[]).includes(r), "Choose a GST slab")
    .default(18),
  pricesIncludeTax: z.boolean().default(false),
  defaultLabourSac: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, "4–8 digits")
    .default("998714"),
});

// Bill paper sizes. `param` is the ?format= value of the /print/invoice route.
export const PRINT_FORMATS = ["A4", "A5", "THERMAL_80", "THERMAL_58"] as const;
export type PrintFormat = (typeof PRINT_FORMATS)[number];
export type PrintParam = "a4" | "a5" | "thermal" | "thermal58";

export const PRINT_FORMAT_INFO: Record<
  PrintFormat,
  { label: string; short: string; param: PrintParam; receipt: boolean }
> = {
  A4: { label: "A4 tax invoice", short: "A4", param: "a4", receipt: false },
  A5: { label: "A5 tax invoice (half page)", short: "A5", param: "a5", receipt: false },
  THERMAL_80: { label: "80 mm receipt (thermal)", short: "80 mm", param: "thermal", receipt: true },
  THERMAL_58: { label: "58 mm receipt (thermal)", short: "58 mm", param: "thermal58", receipt: true },
};

export const printFormatFromParam = (param: string | null | undefined): PrintFormat | undefined =>
  PRINT_FORMATS.find((f) => PRINT_FORMAT_INFO[f].param === param);

export const printSettingsSchema = z.strictObject({
  // Global bill paper size: the POS, invoice screens and print view all use it.
  defaultFormat: z.enum(PRINT_FORMATS).default("A4"),
  invoiceTerms: optionalText(1000).default(null),
  footerText: optionalText(200).default("Thank you for your business."),
  signatureLabel: optionalText(100).default(null),
  showNextServiceDue: z.boolean().default(true),
});

export const posSettingsSchema = z.strictObject({
  allowNegativeStock: z.boolean().default(false),
  maxDiscountPercent: z.coerce.number().min(0).max(100).default(5),
  defaultPaymentMode: z.enum(PAYMENT_MODES).default("CASH"),
  autoPrintAfterCharge: z.boolean().default(false),
});

export const inventorySettingsSchema = z.strictObject({
  // Adjustments whose value (|qty| × purchase price) is above this need a user with stock.approve.
  adjustmentApprovalLimit: z.coerce.number().min(0).max(99_999_999).multipleOf(0.01).default(5000),
});

export const SETTINGS_SCHEMAS = {
  tax: taxSettingsSchema,
  print: printSettingsSchema,
  pos: posSettingsSchema,
  inventory: inventorySettingsSchema,
} as const;

export type TaxSettings = z.output<typeof taxSettingsSchema>;
export type PrintSettings = z.output<typeof printSettingsSchema>;
export type PosSettings = z.output<typeof posSettingsSchema>;
export type InventorySettings = z.output<typeof inventorySettingsSchema>;
export type SettingsValue<G extends SettingsGroup> = z.output<(typeof SETTINGS_SCHEMAS)[G]>;

// Defaults for a fresh install: parse an empty object through each schema.
export const defaultSettings = <G extends SettingsGroup>(group: G): SettingsValue<G> =>
  SETTINGS_SCHEMAS[group].parse({}) as SettingsValue<G>;
