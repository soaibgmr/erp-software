import type { BusinessStatus } from "@prisma/client";
import type { BusinessStatusUpdate } from "@erp-software/shared";

export type UpdateBusinessStatusDto = BusinessStatusUpdate;

// Set on res.locals.platformAdmin by PlatformAuthMiddleware.
export interface PlatformAdminContext {
  adminId: string;
  email: string;
  ip?: string;
}

export interface PlatformAdminDto {
  id: string;
  name: string;
  email: string;
}

export interface PlatformLoginResponseDto {
  admin: PlatformAdminDto;
  token: string;
}

// A registered shop as the platform admin sees it. No sales or stock data, only who and what.
export interface PlatformBusinessDto {
  id: string;
  name: string;
  legalName: string;
  city: string | null;
  stateCode: string;
  gstin: string | null;
  status: BusinessStatus;
  statusNote: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  owner: {
    name: string;
    mobile: string | null;
    email: string | null;
    emailVerified: boolean;
  } | null;
  branchCount: number;
  userCount: number;
}

export interface ListBusinessesQuery {
  page: number;
  limit: number;
  status?: BusinessStatus;
  search?: string;
}

export interface DemoRequestDto {
  id: string;
  name: string | null;
  mobile: string;
  email: string | null;
  handledAt: Date | null;
  createdAt: Date;
}

export interface ListDemoRequestsQuery {
  page: number;
  limit: number;
  /** open = not handled yet. */
  status?: "open" | "handled";
}

export interface OwnerContact {
  firstName: string;
  email: string | null;
}
