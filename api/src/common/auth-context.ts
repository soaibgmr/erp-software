import type { Permission } from "@erp-software/shared";

// Set on res.locals.auth by AuthMiddleware.requireAuth.
export interface AuthContext {
  userId: string;
  // The company (tenant) the user belongs to. Every query on company data must filter by it.
  businessId: string;
  roleId: string;
  roleKey: string | null;
  // OWNER bypasses permission and branch checks.
  isOwner: boolean;
  permissions: Permission[];
  // Branches the user may work in: the assigned ones, or every branch of the business for owners.
  branchIds: string[];
  ip?: string;
}

// branchIds already holds every branch of the owner's business, so this never crosses companies.
export const canAccessBranch = (auth: AuthContext, branchId: string) => auth.branchIds.includes(branchId);

export const hasPermission = (auth: AuthContext, permission: Permission) =>
  auth.isOwner || auth.permissions.includes(permission);
