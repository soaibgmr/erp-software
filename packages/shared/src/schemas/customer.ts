import { z } from "zod";
import {
  mobileSchema,
  optionalEmailSchema,
  optionalGstinSchema,
  optionalMobileSchema,
  optionalPincodeSchema,
  optionalStateCodeSchema,
  optionalText,
  patchOf,
  requiredText,
} from "./common.js";

export const CUSTOMER_TYPES = ["RETAIL", "FLEET", "B2B"] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  RETAIL: "Retail",
  FLEET: "Fleet",
  B2B: "Business (B2B)",
};

const MAX_CREDIT_LIMIT = 99_999_999;

// Field rules only. Cross-field rules live in customerRuleIssues so they can run
// on a full create body and on a PATCH merged with the stored record.
export const customerBaseSchema = z.strictObject({
  type: z.enum(CUSTOMER_TYPES).default("RETAIL"),
  name: requiredText(150),
  mobile: mobileSchema,
  alternatePhone: optionalMobileSchema,
  email: optionalEmailSchema,
  address: optionalText(300),
  city: optionalText(100),
  pincode: optionalPincodeSchema,
  stateCode: optionalStateCodeSchema,
  gstin: optionalGstinSchema,
  creditLimit: z.coerce.number().min(0).max(MAX_CREDIT_LIMIT).multipleOf(0.01).default(0),
  creditDays: z.coerce.number().int().min(0).max(365).default(0),
  notes: optionalText(500),
});

export interface CustomerRuleInput {
  type: CustomerType;
  gstin?: string | null;
  stateCode?: string | null;
}

export function customerRuleIssues(c: CustomerRuleInput): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  if (c.type === "B2B" && !c.gstin)
    issues.push({ path: "gstin", message: "GSTIN is required for a business customer" });
  if (c.gstin && c.stateCode && c.gstin.slice(0, 2) !== c.stateCode) {
    issues.push({ path: "stateCode", message: "State must match the GSTIN state code" });
  }
  return issues;
}

export const customerCreateSchema = customerBaseSchema.superRefine((c, ctx) => {
  for (const issue of customerRuleIssues(c))
    ctx.addIssue({ code: "custom", path: [issue.path], message: issue.message });
});

export const customerUpdateSchema = patchOf(customerBaseSchema);

export type CustomerCreateInput = z.input<typeof customerCreateSchema>;
export type CustomerCreate = z.output<typeof customerCreateSchema>;
export type CustomerUpdate = z.output<typeof customerUpdateSchema>;
