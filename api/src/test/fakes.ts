import { PERMISSIONS, SYSTEM_ROLES, type Permission } from "@automobile/shared";
import type { AuthContext } from "../common/auth-context";
import type { IAuditService } from "../modules/audit/interfaces/iaudit.service";
import type { AuditEntry } from "../modules/audit/audit.types";
import type { RoleResponseDto } from "../modules/roles/role.types";
import type { BranchResponseDto } from "../modules/branches/branch.types";

export const ids = {
  owner: "00000000-0000-4000-8000-000000000001",
  manager: "00000000-0000-4000-8000-000000000002",
  counter: "00000000-0000-4000-8000-000000000003",
  ownerRole: "10000000-0000-4000-8000-000000000001",
  managerRole: "10000000-0000-4000-8000-000000000002",
  counterRole: "10000000-0000-4000-8000-000000000003",
  branchA: "20000000-0000-4000-8000-000000000001",
  branchB: "20000000-0000-4000-8000-000000000002",
};

export function authFor(kind: "owner" | "manager" | "counter", branchIds = [ids.branchA]): AuthContext {
  if (kind === "owner") {
    return {
      userId: ids.owner,
      roleId: ids.ownerRole,
      roleKey: "OWNER",
      isOwner: true,
      permissions: [...PERMISSIONS],
      branchIds,
    };
  }
  const key = kind === "manager" ? "BRANCH_MANAGER" : "COUNTER";
  return {
    userId: ids[kind],
    roleId: kind === "manager" ? ids.managerRole : ids.counterRole,
    roleKey: key,
    isOwner: false,
    permissions: [...SYSTEM_ROLES[key].permissions, ...(kind === "manager" ? (["user.manage"] as Permission[]) : [])],
    branchIds,
  };
}

export function role(id: string, key: keyof typeof SYSTEM_ROLES | null, permissions: string[]): RoleResponseDto {
  return {
    id,
    key,
    name: key ?? "Custom",
    description: null,
    permissions,
    isSystem: key !== null,
    userCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export const roles = {
  owner: role(ids.ownerRole, "OWNER", [...PERMISSIONS]),
  manager: role(ids.managerRole, "BRANCH_MANAGER", SYSTEM_ROLES.BRANCH_MANAGER.permissions),
  counter: role(ids.counterRole, "COUNTER", SYSTEM_ROLES.COUNTER.permissions),
};

export function branch(id: string, overrides: Partial<BranchResponseDto> = {}): BranchResponseDto {
  return {
    id,
    code: id.slice(-3),
    name: `Branch ${id.slice(-1)}`,
    address: null,
    city: "Kochi",
    pincode: null,
    stateCode: "32",
    gstin: null,
    phone: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export class FakeAudit implements IAuditService {
  entries: AuditEntry[] = [];
  async record(_actor: unknown, entry: AuditEntry) {
    this.entries.push(entry);
  }
  async list() {
    return { data: [], page: 1, limit: 20, total: 0 };
  }
}

// Builds an object implementing only the methods a test needs; calling anything else fails loudly.
export function stub<T extends object>(impl: Partial<T>): T {
  return new Proxy(impl, {
    get(target, prop) {
      if (prop in target) return target[prop as keyof typeof target];
      if (prop === "then") return undefined;
      throw new Error(`Unexpected call to ${String(prop)}`);
    },
  }) as T;
}
