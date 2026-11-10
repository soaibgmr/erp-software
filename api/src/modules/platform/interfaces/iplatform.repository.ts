import type { BusinessStatus } from "@prisma/client";
import type { Paginated } from "../../../common/pagination";
import type { ListBusinessesQuery, OwnerContact, PlatformAdminDto, PlatformBusinessDto } from "../platform.types";

export interface IPlatformRepository {
  findAdminCredentials(email: string): Promise<(PlatformAdminDto & { passwordHash: string }) | null>;
  findAdmin(id: string): Promise<PlatformAdminDto | null>;
  touchAdminLogin(id: string): Promise<void>;
  listBusinesses(query: ListBusinessesQuery): Promise<Paginated<PlatformBusinessDto>>;
  findBusiness(id: string): Promise<PlatformBusinessDto | null>;
  setBusinessStatus(id: string, status: BusinessStatus, note: string | null): Promise<void>;
  // The first active owner of the shop, for status emails.
  findOwnerContact(businessId: string): Promise<OwnerContact | null>;
}
