import type { Paginated } from "../../../common/pagination";
import type {
  ListBusinessesQuery,
  PlatformAdminContext,
  PlatformAdminDto,
  PlatformBusinessDto,
  PlatformLoginResponseDto,
  UpdateBusinessStatusDto,
} from "../platform.types";

export interface IPlatformService {
  login(email: string, password: string, ip?: string): Promise<PlatformLoginResponseDto>;
  me(admin: PlatformAdminContext): Promise<PlatformAdminDto>;
  listBusinesses(query: ListBusinessesQuery): Promise<Paginated<PlatformBusinessDto>>;
  // Approve (ACTIVE), reject or suspend a shop; emails the owner.
  updateStatus(admin: PlatformAdminContext, id: string, input: UpdateBusinessStatusDto): Promise<PlatformBusinessDto>;
}
