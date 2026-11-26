import { inject, injectable } from "inversify";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { TYPES } from "../../config/ioc.types";
import { env } from "../../config/env";
import { BCRYPT_ROUNDS } from "../../common/constants";
import { badRequest, fieldErrors, notFound, unauthorized } from "../../common/http-error";
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
  PlatformSummaryDto,
  UpdateBusinessStatusDto,
} from "./platform.types";

const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", BCRYPT_ROUNDS);
// No refresh token for the admin console: sign in again after a working day.
const TOKEN_TTL = "12h";

const signToken = (adminId: string) =>
  jwt.sign({}, env.JWT_SECRET, { subject: adminId, audience: PLATFORM_AUDIENCE, expiresIn: TOKEN_TTL });

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
    const { passwordHash: _hash, ...admin } = found;
    return { admin: { ...admin, lastLoginAt: new Date() }, token: signToken(found.id) };
  }

  async me(admin: PlatformAdminContext): Promise<PlatformAdminDto> {
    const found = await this.platform.findAdmin(admin.adminId);
    if (!found) throw unauthorized();
    return found;
  }

  async changePassword(
    admin: PlatformAdminContext,
    currentPassword: string,
    newPassword: string,
  ): Promise<PlatformLoginResponseDto> {
    // Same lockout as login, so a stolen session can't be used to guess the password.
    const lockKey = `platform-password:${admin.adminId}`;
    await assertNotLocked(this.limiter, lockKey);
    const found = await this.platform.findAdminCredentials(admin.email);
    if (!found || found.id !== admin.adminId) throw unauthorized();
    if (!(await bcrypt.compare(currentPassword, found.passwordHash))) {
      await this.limiter.hit(lockKey, ACCOUNT_LOCK.windowMs);
      throw fieldErrors([{ path: "currentPassword", message: "Current password is incorrect" }]);
    }
    if (currentPassword === newPassword) {
      throw fieldErrors([{ path: "newPassword", message: "Choose a password different from the current one" }]);
    }
    await this.limiter.reset(lockKey);

    const changedAt = new Date();
    await this.platform.setAdminPassword(found.id, await bcrypt.hash(newPassword, BCRYPT_ROUNDS), changedAt);
    const { passwordHash: _hash, ...rest } = found;
    return { admin: { ...rest, passwordChangedAt: changedAt }, token: signToken(found.id) };
  }

  summary(): Promise<PlatformSummaryDto> {
    return this.platform.summary();
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
