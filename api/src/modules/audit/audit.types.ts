import type { Prisma } from "@prisma/client";
import type { AuthContext } from "../../common/auth-context";

export interface AuditEntry {
  action: string; // e.g. "customer.delete", "role.update"
  entity: string; // e.g. "Customer"
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  branchId?: string | null;
}

export interface CreateAuditLogData {
  businessId: string | null;
  actorId: string | null;
  branchId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  before: Prisma.InputJsonValue | undefined;
  after: Prisma.InputJsonValue | undefined;
  ip: string | null;
}

export interface AuditLogResponseDto {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  branchId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: Date;
  actor: { id: string; firstName: string; lastName: string } | null;
}

export interface ListAuditLogsQuery {
  page: number;
  limit: number;
  entity?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
  from?: Date;
  to?: Date;
}

// Who did it and in which company. userId is null for platform-admin actions (the admin is named in the entry).
export type AuditActor = { userId: string | null; businessId: string | null; ip?: AuthContext["ip"] } | null;
