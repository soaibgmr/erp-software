import { inject, injectable } from "inversify";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { TYPES } from "../../config/ioc.types";
import { env } from "../../config/env";
import { BCRYPT_ROUNDS } from "../../common/constants";
import { badRequest, notFound, unauthorized } from "../../common/http-error";
import type { Paginated } from "../../common/pagination";
import { ACCOUNT_LOCK, assertNotLocked, type IAttemptLimiter } from "../../common/attempt-limiter";
import { PLATFORM_AUDIENCE } from "../../common/tenant";
import type { IAuditService } from "../audit/interfaces/iaudit.service";
import type { IMailService } from "../mail/interfaces/imail.service";
import { demoRequestMail, shopStatusMail } from "../mail/mail.templates";
import type { DemoRequest } from "@erp-software/shared";
import type { IPlatformRepository } from "./interfaces/iplatform.repository";
import type { IPlatformService } from "./interfaces/iplatform.service";
import type {
  DemoRequestDto,
  ListBusinessesQuery,
  ListDemoRequestsQuery,
  PlatformAdminContext,
  PlatformAdminDto,
  PlatformBusinessDto,
  PlatformLoginResponseDto,
  UpdateBusinessStatusDto,
} from "./platform.types";

const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", BCRYPT_ROUNDS);
// No refresh token for the admin console: sign in again after a working day.
const TOKEN_TTL = "12h";

@injectable()
export class PlatformService implements IPlatformService {
  constructor(
    @inject(TYPES.PlatformRepository) private readonly platform: IPlatformRepository,
    @inject(TYPES.MailService) private readonly mail: IMailService,
    @inject(TYPES.AuditService) private readonly audit: IAuditService,
    @inject(TYPES.AttemptLimiter) private readonly limiter: IAttemptLimiter,
  ) {}

  async login(email: string, password: string): Promise<PlatformLoginResponseDto> {
    const lockKey = `platform-login:${email.trim().toLowerCase()}`;
    await assertNotLocked(this.limiter, lockKey);
    const found = await this.platform.findAdminCredentials(email);
    const valid = await bcrypt.compare(password, found?.passwordHash ?? DUMMY_HASH);
    if (!found || !valid) {
      await this.limiter.hit(lockKey, ACCOUNT_LOCK.windowMs);
      throw unauthorized("Email or password is incorrect");
    }
    await this.limiter.reset(lockKey);

    await this.platform.touchAdminLogin(found.id);
    const token = jwt.sign({}, env.JWT_SECRET, {
      subject: found.id,
      audience: PLATFORM_AUDIENCE,
      expiresIn: TOKEN_TTL,
    });
    return { admin: { id: found.id, name: found.name, email: found.email }, token };
  }

  async me(admin: PlatformAdminContext): Promise<PlatformAdminDto> {
    const found = await this.platform.findAdmin(admin.adminId);
    if (!found) throw unauthorized();
    return found;
  }

  listBusinesses(query: ListBusinessesQuery): Promise<Paginated<PlatformBusinessDto>> {
    return this.platform.listBusinesses(query);
  }

  async updateStatus(
    admin: PlatformAdminContext,
    id: string,
    { status, note }: UpdateBusinessStatusDto,
  ): Promise<PlatformBusinessDto> {
    const before = await this.platform.findBusiness(id);
    if (!before) throw notFound("Shop not found");
    if (before.status === status) throw badRequest("The shop already has this status");
    // A rejected registration can be approved later; only an approved shop can be put on hold.
    if (status === "SUSPENDED" && before.status !== "ACTIVE") throw badRequest("Only an active shop can be suspended");
    if (status === "REJECTED" && before.status !== "PENDING") throw badRequest("Only a waiting shop can be rejected");

    await this.platform.setBusinessStatus(id, status, note ?? null);
    // Platform admins aren't shop users, so the actor is recorded in the entry itself.
    await this.audit.record(
      { userId: null, businessId: id, ip: admin.ip },
      {
        action: `business.status.${status.toLowerCase()}`,
        entity: "Business",
        entityId: id,
        before: { status: before.status },
        after: { status, note: note ?? null, byPlatformAdmin: admin.email },
      },
    );

    const owner = await this.platform.findOwnerContact(id);
    if (owner?.email) {
      await this.mail.sendQuietly({
        to: owner.email,
        ...shopStatusMail({ firstName: owner.firstName, shopName: before.name, status, note: note ?? null }),
      });
    }
    const after = await this.platform.findBusiness(id);
    if (!after) throw notFound("Shop not found");
    return after;
  }

  async requestDemo({ name, mobile, email, website }: DemoRequest, ip?: string): Promise<void> {
    // Spam trap filled in: answer as if it worked, but keep nothing.
    if (website) return;
    const saved = await this.platform.createDemoRequest({
      name: name ?? null,
      mobile,
      email: email ?? null,
      ip: ip?.slice(0, 64) ?? null,
    });
    if (env.PLATFORM_ADMIN_NOTIFY_EMAIL) {
      await this.mail.sendQuietly({ to: env.PLATFORM_ADMIN_NOTIFY_EMAIL, ...demoRequestMail(saved) });
    }
  }

  listDemoRequests(query: ListDemoRequestsQuery): Promise<Paginated<DemoRequestDto>> {
    return this.platform.listDemoRequests(query);
  }

  async setDemoRequestHandled(id: string, handled: boolean): Promise<DemoRequestDto> {
    const found = await this.platform.setDemoRequestHandled(id, handled);
    if (!found) throw notFound("Demo request not found");
    return found;
  }
}
