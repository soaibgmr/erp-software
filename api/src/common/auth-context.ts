import type { Permission } from "@automobile/shared";

// Set on res.locals.auth by AuthMiddleware.requireAuth.
export interface AuthContext {
  userId: string;
  roleId: string;
  roleKey: string | null;
  // OWNER bypasses permission and branch checks.
  isOwner: boolean;
  permissions: Permission[];
  // Branches the user is assigned to (ignored for owners, who can use any branch).
  branchIds: string[];
  ip?: string;
}

export const canAccessBranch = (auth: AuthContext, branchId: string) =>
  auth.isOwner || auth.branchIds.includes(branchId);

export const hasPermission = (auth: AuthContext, permission: Permission) =>
  auth.isOwner || auth.permissions.includes(permission);
