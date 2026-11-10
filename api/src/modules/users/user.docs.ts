import { UserStatus } from "@prisma/client";
import {
  BUSINESS_STATUSES,
  forgotPasswordSchema,
  PERMISSIONS,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "@erp-software/shared";
import {
  fromZod,
  operation,
  pathParam,
  type Paths,
  queryParams,
  ref,
  type SchemaObject,
  success,
} from "../../docs/openapi.helpers";
import {
  changePasswordSchema,
  createUserSchema,
  listUsersQuerySchema,
  loginSchema,
  refreshSchema,
  setPasswordSchema,
  updateMeSchema,
  updateUserSchema,
} from "./user.schema";

const branchSummary = {
  type: "object",
  properties: { id: { type: "string", format: "uuid" }, code: { type: "string" }, name: { type: "string" } },
};

// Response shapes (UserResponseDto, MeResponseDto, TokenPair, AuthResponseDto in user.types.ts).
export const userSchemas: Record<string, SchemaObject> = {
  User: {
    type: "object",
    required: [
      "id",
      "firstName",
      "lastName",
      "mobile",
      "email",
      "phone",
      "status",
      "role",
      "branches",
      "createdAt",
      "updatedAt",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      firstName: { type: "string" },
      lastName: { type: "string" },
      mobile: { type: ["string", "null"], description: "Login id; unique across every shop." },
      email: { type: ["string", "null"], format: "email" },
      emailVerifiedAt: { type: ["string", "null"], format: "date-time" },
      phone: { type: ["string", "null"] },
      status: { type: "string", enum: Object.values(UserStatus) },
      lastLoginAt: { type: ["string", "null"], format: "date-time" },
      role: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          key: { type: ["string", "null"] },
          name: { type: "string" },
        },
      },
      branches: { type: "array", items: branchSummary },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  Me: {
    type: "object",
    properties: {
      user: ref("User"),
      business: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          status: { type: "string", enum: [...BUSINESS_STATUSES] },
        },
      },
      isOwner: { type: "boolean" },
      permissions: { type: "array", items: { type: "string", enum: [...PERMISSIONS] } },
      branches: {
        type: "array",
        items: {
          type: "object",
          properties: {
            ...branchSummary.properties,
            stateCode: { type: "string" },
            city: { type: ["string", "null"] },
          },
        },
      },
    },
  },
  TokenPair: {
    type: "object",
    required: ["token", "refreshToken"],
    properties: {
      token: { type: "string", description: "JWT access token. Send as `Authorization: Bearer <token>`." },
      refreshToken: { type: "string", description: "Opaque refresh token, single use (rotated on refresh)." },
    },
  },
  AuthResponse: {
    allOf: [ref("TokenPair"), { type: "object", required: ["user"], properties: { user: ref("User") } }],
  },
};

const auth = "Auth";
const me = "Users - Me";
const admin = "Users";
const manage = "Requires `user.manage`.";
const empty = { type: "null" };

export const userPaths: Paths = {
  "/api/v1/auth/register": {
    post: operation({
      tag: auth,
      summary: "Register a shop",
      description:
        "Creates the shop (PENDING), its system roles, a MAIN branch and the owner account, then emails the owner a confirm-email link. " +
        "The owner can log in once the platform admin approves the shop. Mobile and email must be free across every shop.",
      auth: "client",
      body: fromZod(registerSchema),
      responses: {
        201: success("Waiting for approval", { type: "object", properties: { status: { const: "PENDING" } } }),
      },
    }),
  },
  "/api/v1/auth/forgot-password": {
    post: operation({
      tag: auth,
      summary: "Email a password reset link",
      description: "Always 200. A 30-minute, single-use link goes to the account's email, if it has one.",
      auth: "client",
      body: fromZod(forgotPasswordSchema),
      responses: { 200: success("Sent if possible", empty) },
    }),
  },
  "/api/v1/auth/reset-password": {
    post: operation({
      tag: auth,
      summary: "Set a new password from a reset link",
      description: "Signs out every session of the user.",
      auth: "client",
      body: fromZod(resetPasswordSchema),
      responses: { 200: success("Password changed", empty) },
    }),
  },
  "/api/v1/auth/verify-email": {
    post: operation({
      tag: auth,
      summary: "Confirm an email address",
      auth: "client",
      body: fromZod(verifyEmailSchema),
      responses: { 200: success("Email confirmed", empty) },
    }),
  },
  "/api/v1/auth/login": {
    post: operation({
      tag: auth,
      summary: "Log in with mobile number (or email) and password",
      description:
        "Unknown accounts, wrong passwords and inactive users all return the same 401. With the right password, a shop that " +
        "isn't ACTIVE gets 403 `BUSINESS_PENDING`, `BUSINESS_SUSPENDED` or `BUSINESS_REJECTED`.",
      auth: "client",
      body: fromZod(loginSchema),
      responses: { 200: success("Logged in successfully", ref("AuthResponse")) },
    }),
  },
  "/api/v1/auth/refresh": {
    post: operation({
      tag: auth,
      summary: "Rotate a refresh token",
      description:
        "Revokes the presented refresh token and issues a new pair. Reusing a revoked token revokes all of that user's tokens.",
      auth: "client",
      body: fromZod(refreshSchema),
      responses: { 200: success("Token refreshed", ref("TokenPair")) },
    }),
  },
  "/api/v1/auth/logout": {
    post: operation({
      tag: auth,
      summary: "Log out",
      description: "Revokes the refresh token. Always returns 200.",
      auth: "client",
      body: fromZod(refreshSchema),
      responses: { 200: success("Logged out successfully", empty) },
    }),
  },
  "/api/v1/users/me": {
    get: operation({
      tag: me,
      summary: "Current user, permissions and branches",
      responses: { 200: success("Current user", ref("Me")) },
    }),
    patch: operation({
      tag: me,
      summary: "Update the current user's profile",
      body: fromZod(updateMeSchema),
      responses: { 200: success("Profile updated", ref("User")) },
    }),
  },
  "/api/v1/users/me/password": {
    patch: operation({
      tag: me,
      summary: "Change password",
      description: "Checks the current password and revokes all refresh tokens.",
      body: fromZod(changePasswordSchema),
      responses: { 200: success("Password changed", empty) },
    }),
  },
  "/api/v1/users": {
    post: operation({
      tag: admin,
      summary: "Create a user",
      description: `${manage} Non-owners can only assign roles within their own permissions and their own branches.`,
      body: fromZod(createUserSchema),
      responses: { 201: success("User created", ref("User")) },
    }),
    get: operation({
      tag: admin,
      summary: "List users",
      description: `${manage} \`search\` matches name, email or phone.`,
      parameters: queryParams(listUsersQuerySchema),
      responses: { 200: success("Users", { type: "array", items: ref("User") }, { paginated: true }) },
    }),
  },
  "/api/v1/users/{id}": {
    get: operation({
      tag: admin,
      summary: "Get a user",
      description: manage,
      parameters: [pathParam("id")],
      responses: { 200: success("User", ref("User")) },
    }),
    patch: operation({
      tag: admin,
      summary: "Update a user",
      description: `${manage} You can't change your own role or deactivate yourself; at least one active owner must remain.`,
      parameters: [pathParam("id")],
      body: fromZod(updateUserSchema),
      responses: { 200: success("User updated", ref("User")) },
    }),
    delete: operation({
      tag: admin,
      summary: "Soft-delete a user",
      description: `${manage} You can't delete yourself.`,
      parameters: [pathParam("id")],
      responses: { 200: success("User deleted", empty) },
    }),
  },
  "/api/v1/users/{id}/password": {
    post: operation({
      tag: admin,
      summary: "Set a new password for a user",
      description: `${manage} For staff who can't reset it by email. Signs the user out everywhere. Only owners can change an owner's password.`,
      parameters: [pathParam("id")],
      body: fromZod(setPasswordSchema),
      responses: { 200: success("Password changed", empty) },
    }),
  },
};
