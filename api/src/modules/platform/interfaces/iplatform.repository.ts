import type { BusinessStatus } from "@prisma/client";
import type { Paginated } from "../../../common/pagination";
import type {
  DemoRequestDto,
  ListBusinessesQuery,
  ListDemoRequestsQuery,
  OwnerContact,
  PlatformAdminDto,
  PlatformBusinessDto,
  PlatformSummaryDto,
} from "../platform.types";

export interface IPlatformRepository {
  findAdminCredentials(email: string): Promise<(PlatformAdminDto & { passwordHash: string }) | null>;
  findAdmin(id: string): Promise<PlatformAdminDto | null>;
  touchAdminLogin(id: string): Promise<void>;
  // Saves the new hash and stamps password_changed_at (older tokens stop working).
  setAdminPassword(id: string, passwordHash: string, changedAt: Date): Promise<void>;
  summary(): Promise<PlatformSummaryDto>;
  listBusinesses(query: ListBusinessesQuery): Promise<Paginated<PlatformBusinessDto>>;
  findBusiness(id: string): Promise<PlatformBusinessDto | null>;
  setBusinessStatus(id: string, status: BusinessStatus, note: string | null): Promise<void>;
  // The first active owner of the shop, for status emails.
  findOwnerContact(businessId: string): Promise<OwnerContact | null>;
  createDemoRequest(data: {
    name: string | null;
    mobile: string;
    email: string | null;
    ip: string | null;
  }): Promise<DemoRequestDto>;
  listDemoRequests(query: ListDemoRequestsQuery): Promise<Paginated<DemoRequestDto>>;
  /** Marks a request handled (or open again); null when it doesn't exist. */
  setDemoRequestHandled(id: string, handled: boolean): Promise<DemoRequestDto | null>;
}
