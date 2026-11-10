import { inject, injectable } from "inversify";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { TYPES } from "../../config/ioc.types";
import { env } from "../../config/env";
import { BCRYPT_ROUNDS } from "../../common/constants";
import { badRequest, notFound, unauthorized } from "../../common/http-error";
import type { Paginated } from "../../common/pagination";
import { PLATFORM_AUDIENCE } from "../../common/tenant";
import type { IAuditService } from "../audit/interfaces/iaudit.service";
import type { IMailService } from "../mail/interfaces/imail.service";
import { shopStatusMail } from "../mail/mail.templates";
import type { IPlatformRepository } from "./interfaces/iplatform.repository";
import type { IPlatformService } from "./interfaces/iplatform.service";
import type {
  ListBusinessesQuery,
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
  ) {}

  async login(email: string, password: string): Promise<PlatformLoginResponseDto> {
    const found = await this.platform.findAdminCredentials(email);
    const valid = await bcrypt.compare(password, found?.passwordHash ?? DUMMY_HASH);
    if (!found || !valid) throw unauthorized("Email or password is incorrect");

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
}
