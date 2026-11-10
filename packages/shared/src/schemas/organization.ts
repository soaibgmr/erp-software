import { z } from "zod";
import { PERMISSIONS, type Permission } from "../permissions.js";
import { DOCUMENT_TYPES } from "../documents.js";
import {
  optionalEmailSchema,
  optionalGstinSchema,
  optionalMobileSchema,
  mobileSchema,
  loginIdentifierSchema,
  optionalPincodeSchema,
  optionalText,
  requiredText,
  patchOf,
  stateCodeSchema,
} from "./common.js";

// ---- Business profile (one row) ----
export const businessUpdateSchema = z
  .strictObject({
    legalName: requiredText(200),
    tradeName: optionalText(200),
    address: optionalText(300),
    city: optionalText(100),
    pincode: optionalPincodeSchema,
    stateCode: stateCodeSchema,
    gstin: optionalGstinSchema,
    phone: optionalMobileSchema,
    email: optionalEmailSchema,
    website: optionalText(200),
    bankName: optionalText(100),
    bankAccountNo: optionalText(30),
    bankIfsc: optionalText(11),
    upiId: optionalText(100),
  })
  .partial()
  .superRefine((b, ctx) => {
    if (b.gstin && b.stateCode && b.gstin.slice(0, 2) !== b.stateCode) {
      ctx.addIssue({ code: "custom", path: ["stateCode"], message: "State must match the GSTIN state code" });
    }
  });
export type BusinessUpdate = z.output<typeof businessUpdateSchema>;

// ---- Branches ----
export const branchBaseSchema = z.strictObject({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,10}$/, "2–10 letters or digits"),
  name: requiredText(100),
  address: optionalText(300),
  city: optionalText(100),
  pincode: optionalPincodeSchema,
  stateCode: stateCodeSchema,
  gstin: optionalGstinSchema,
  phone: optionalMobileSchema,
  isActive: z.boolean().default(true),
});

export const branchCreateSchema = branchBaseSchema.superRefine((b, ctx) => {
  if (b.gstin && b.gstin.slice(0, 2) !== b.stateCode) {
    ctx.addIssue({ code: "custom", path: ["stateCode"], message: "State must match the GSTIN state code" });
  }
});
export const branchUpdateSchema = patchOf(branchBaseSchema);
export type BranchCreate = z.output<typeof branchCreateSchema>;
export type BranchUpdate = z.output<typeof branchUpdateSchema>;

// ---- Roles ----
const permissionSchema = z.enum(PERMISSIONS as [Permission, ...Permission[]]);

export const roleCreateSchema = z.strictObject({
  name: requiredText(60),
  description: optionalText(200),
  permissions: z.array(permissionSchema).max(PERMISSIONS.length),
});
export const roleUpdateSchema = roleCreateSchema.partial();
export type RoleCreate = z.output<typeof roleCreateSchema>;
export type RoleUpdate = z.output<typeof roleUpdateSchema>;

// ---- Users ----
export const USER_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

const personName = requiredText(100);
const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address").max(255));
// bcrypt ignores bytes past 72.
export const passwordSchema = z.string().min(8, "At least 8 characters").max(72);

// Staff log in with their mobile number; email is optional (needed only for password-reset emails).
export const userCreateSchema = z.strictObject({
  firstName: personName,
  lastName: personName,
  mobile: mobileSchema,
  email: optionalEmailSchema,
  password: passwordSchema,
  phone: optionalMobileSchema,
  roleId: z.uuid("Choose a role"),
  branchIds: z.array(z.uuid()).max(100).default([]),
  status: z.enum(USER_STATUSES).default("ACTIVE"),
});
export const userUpdateSchema = patchOf(userCreateSchema.omit({ password: true }));
export type UserCreate = z.output<typeof userCreateSchema>;
export type UserUpdate = z.output<typeof userUpdateSchema>;

export const loginSchema = z.strictObject({
  identifier: loginIdentifierSchema,
  password: z.string().min(1, "Enter your password").max(72),
});
export type LoginInput = z.output<typeof loginSchema>;

// ---- Shop sign-up (self registration; the shop stays pending until the platform admin approves it) ----
export const registerSchema = z
  .strictObject({
    shopName: requiredText(200, 2),
    city: requiredText(100),
    stateCode: stateCodeSchema,
    gstin: optionalGstinSchema,
    ownerFirstName: personName,
    ownerLastName: personName,
    mobile: mobileSchema,
    email,
    password: passwordSchema,
  })
  .superRefine((b, ctx) => {
    if (b.gstin && b.gstin.slice(0, 2) !== b.stateCode) {
      ctx.addIssue({ code: "custom", path: ["stateCode"], message: "State must match the GSTIN state code" });
    }
  });
export type RegisterInput = z.output<typeof registerSchema>;

export const forgotPasswordSchema = z.strictObject({ identifier: loginIdentifierSchema });
export const resetPasswordSchema = z.strictObject({
  token: z.string().trim().min(20).max(200),
  password: passwordSchema,
});
export const verifyEmailSchema = z.strictObject({ token: z.string().trim().min(20).max(200) });

// ---- Platform admin ----
export const BUSINESS_STATUSES = ["PENDING", "ACTIVE", "SUSPENDED", "REJECTED"] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];
export const BUSINESS_STATUS_LABELS: Record<BusinessStatus, string> = {
  PENDING: "Waiting for approval",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  REJECTED: "Rejected",
};

export const platformLoginSchema = z.strictObject({
  email,
  password: z.string().min(1, "Enter your password").max(72),
});
export const businessStatusUpdateSchema = z.strictObject({
  status: z.enum(["ACTIVE", "SUSPENDED", "REJECTED"]),
  note: optionalText(300),
});
export type BusinessStatusUpdate = z.output<typeof businessStatusUpdateSchema>;

// ---- Number series ----
export const documentTypeSchema = z.enum(DOCUMENT_TYPES);

export const documentSequenceUpdateSchema = z.strictObject({
  prefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{1,6}$/, "1–6 letters"),
  padding: z.coerce.number().int().min(3).max(8),
});
export type DocumentSequenceUpdate = z.output<typeof documentSequenceUpdateSchema>;
