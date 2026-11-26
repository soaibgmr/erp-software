import type { Paginated } from "../../../common/pagination";
import type { DemoRequest } from "@erp-software/shared";
import type {
  DemoRequestDto,
  ListBusinessesQuery,
  ListDemoRequestsQuery,
  PlatformAdminContext,
  PlatformAdminDto,
  PlatformBusinessDto,
  PlatformLoginResponseDto,
  PlatformSummaryDto,
  UpdateBusinessStatusDto,
} from "../platform.types";

export interface IPlatformService {
  login(email: string, password: string, ip?: string): Promise<PlatformLoginResponseDto>;
  me(admin: PlatformAdminContext): Promise<PlatformAdminDto>;
  // Checks the current password, saves the new one and signs out every other device.
  // Returns a fresh token so the device that changed it stays signed in.
  changePassword(
    admin: PlatformAdminContext,
    currentPassword: string,
    newPassword: string,
  ): Promise<PlatformLoginResponseDto>;
  summary(): Promise<PlatformSummaryDto>;
  listBusinesses(query: ListBusinessesQuery): Promise<Paginated<PlatformBusinessDto>>;
  // Approve (ACTIVE), reject or suspend a shop; emails the owner.
  updateStatus(admin: PlatformAdminContext, id: string, input: UpdateBusinessStatusDto): Promise<PlatformBusinessDto>;
  // Public: saves a "Book a quick demo" request and emails the platform admin.
  requestDemo(input: DemoRequest, ip?: string): Promise<void>;
  listDemoRequests(query: ListDemoRequestsQuery): Promise<Paginated<DemoRequestDto>>;
  setDemoRequestHandled(id: string, handled: boolean): Promise<DemoRequestDto>;
}
