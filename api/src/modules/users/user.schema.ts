import { z } from "zod";
import { UserStatus } from "@prisma/client";
import {
  loginSchema,
  optionalMobileSchema,
  passwordSchema,
  userCreateSchema,
  userUpdateSchema,
} from "@erp-software/shared";
import { paginationQuery, searchQuery } from "../../common/schemas";

export { loginSchema, userCreateSchema as createUserSchema, userUpdateSchema as updateUserSchema };

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: passwordSchema,
});

const name = z.string().trim().min(1).max(100);

export const updateMeSchema = z.strictObject({
  firstName: name.optional(),
  lastName: name.optional(),
  phone: optionalMobileSchema,
});

export const listUsersQuerySchema = z.object({
  ...paginationQuery,
  roleId: z.uuid().optional(),
  branchId: z.uuid().optional(),
  status: z.enum(UserStatus).optional(),
  search: searchQuery,
});
