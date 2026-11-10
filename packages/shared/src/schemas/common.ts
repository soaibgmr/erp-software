import { z } from "zod";
import { checkGstin, isValidMobile, isValidPincode, normalizeMobile, STATE_CODES } from "../india.js";

// Form inputs send "" for an empty optional field; store it as null.
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const requiredText = (max: number, min = 1) => z.string().trim().min(min, "Required").max(max);

export const mobileSchema = z
  .string()
  .trim()
  .refine(isValidMobile, "Enter a 10-digit mobile number")
  .transform(normalizeMobile);

export const optionalMobileSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidMobile(v), "Enter a 10-digit mobile number")
  .transform((v) => (v === "" ? null : normalizeMobile(v)))
  .nullable()
  .optional();

export const optionalEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address")
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

export const optionalPincodeSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidPincode(v), "Enter a 6-digit PIN code")
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

export const stateCodeSchema = z.string().refine((v) => STATE_CODES.includes(v), "Choose a state");

export const optionalStateCodeSchema = z
  .string()
  .refine((v) => v === "" || STATE_CODES.includes(v), "Choose a state")
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

export const optionalGstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .superRefine((v, ctx) => {
    if (v === "") return;
    const check = checkGstin(v);
    if (!check.valid) ctx.addIssue({ code: "custom", message: check.reason });
  })
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

export const uuidSchema = z.uuid();

type PatchShape<S extends z.core.$ZodShape> = { [K in keyof S]: z.ZodOptional<S[K]> };

// Update (PATCH) schema from a create schema. zod 4's .partial() still applies .default() values,
// so a PATCH of one field would silently reset every defaulted field; this drops the defaults instead.
export function patchOf<S extends z.core.$ZodShape>(
  schema: z.ZodObject<S>,
): z.ZodObject<PatchShape<S>, z.core.$strict> {
  const shape: Record<string, z.ZodType> = {};
  for (const [key, field] of Object.entries(schema.shape)) {
    const inner = field instanceof z.ZodDefault ? (field.removeDefault() as z.ZodType) : (field as z.ZodType);
    shape[key] = inner.optional();
  }
  return z.strictObject(shape) as unknown as z.ZodObject<PatchShape<S>, z.core.$strict>;
}
