import { inject, injectable } from "inversify";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { formatMobile } from "@erp-software/shared";
import { TYPES } from "../../config/ioc.types";
import { env } from "../../config/env";
import { BCRYPT_ROUNDS } from "../../common/constants";
import { badRequest, fieldErrors } from "../../common/http-error";
import type { IUnitOfWork } from "../../common/unit-of-work";
import type { IAuditService } from "../audit/interfaces/iaudit.service";
import { provisionBusiness } from "../business/provision";
import type { IMailService } from "../mail/interfaces/imail.service";
import { resetPasswordMail, shopReceivedMail, shopRegisteredMail } from "../mail/mail.templates";
import type { IAccountService } from "./interfaces/iaccount.service";
import type { IAuthTokenRepository } from "./interfaces/iauth-token.repository";
import type { IRefreshTokenRepository } from "./interfaces/irefresh-token.repository";
import type { IUserRepository } from "./interfaces/iuser.repository";
import type { RegisterDto } from "./user.types";

const RESET_MINUTES = 30;
const VERIFY_HOURS = 48;
const INVALID_LINK = "This link is invalid or has expired. Please ask for a new one.";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

@injectable()
export class AccountService implements IAccountService {
  constructor(
    @inject(TYPES.UserRepository) private readonly users: IUserRepository,
    @inject(TYPES.AuthTokenRepository) private readonly tokens: IAuthTokenRepository,
    @inject(TYPES.RefreshTokenRepository) private readonly refreshTokens: IRefreshTokenRepository,
    @inject(TYPES.UnitOfWork) private readonly uow: IUnitOfWork,
    @inject(TYPES.MailService) private readonly mail: IMailService,
    @inject(TYPES.AuditService) private readonly audit: IAuditService,
  ) {}

  async register(input: RegisterDto, ip?: string): Promise<{ status: "PENDING" }> {
    // Mobile and email identify one person across every shop. The unique indexes catch races (409).
    const issues: { path: string; message: string }[] = [];
    if (await this.users.existsByMobile(input.mobile)) {
      issues.push({ path: "mobile", message: "This mobile number is already registered. Try logging in." });
    }
    if (await this.users.existsByEmail(input.email)) {
      issues.push({ path: "email", message: "This email is already registered. Try logging in." });
    }
    if (issues.length) throw fieldErrors(issues);

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const created = await this.uow.run((tx) =>
      provisionBusiness(tx, {
        status: "PENDING",
        legalName: input.shopName,
        city: input.city,
        stateCode: input.stateCode,
        gstin: input.gstin,
        owner: {
          firstName: input.ownerFirstName,
          lastName: input.ownerLastName,
          mobile: input.mobile,
          email: input.email,
          passwordHash,
        },
      }),
    );
    await this.audit.record(
      { userId: created.ownerId, businessId: created.businessId, ip },
      {
        action: "business.register",
        entity: "Business",
        entityId: created.businessId,
        after: { ...input, password: undefined },
      },
    );

    const verifyToken = await this.issueToken(created.ownerId, "VERIFY_EMAIL", VERIFY_HOURS * 60);
    await this.mail.sendQuietly({
      to: input.email,
      ...shopReceivedMail({
        firstName: input.ownerFirstName,
        shopName: input.shopName,
        verifyToken,
        hours: VERIFY_HOURS,
      }),
    });
    if (env.PLATFORM_ADMIN_NOTIFY_EMAIL) {
      await this.mail.sendQuietly({
        to: env.PLATFORM_ADMIN_NOTIFY_EMAIL,
        ...shopRegisteredMail({
          shopName: input.shopName,
          ownerName: `${input.ownerFirstName} ${input.ownerLastName}`,
          mobile: formatMobile(input.mobile),
          email: input.email,
          city: input.city,
        }),
      });
    }
    return { status: "PENDING" };
  }

  async forgotPassword(identifier: string): Promise<void> {
    const user = await this.users.findContactByIdentifier(identifier);
    // No account, or no email to send to: say nothing (the owner can reset staff passwords).
    if (!user?.email) return;
    const token = await this.issueToken(user.id, "RESET_PASSWORD", RESET_MINUTES);
    await this.mail.sendQuietly({
      to: user.email,
      ...resetPasswordMail({ firstName: user.firstName, token, minutes: RESET_MINUTES }),
    });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const userId = await this.tokens.consume(hashToken(token), "RESET_PASSWORD");
    if (!userId) throw badRequest(INVALID_LINK);
    const contact = await this.users.findContactById(userId);
    if (!contact) throw badRequest(INVALID_LINK);

    await this.users.updatePasswordHash(userId, await bcrypt.hash(password, BCRYPT_ROUNDS));
    // The link reached their inbox, so the email is theirs.
    await this.users.markEmailVerified(userId);
    // Sign out every session that might have used the old password.
    await this.refreshTokens.revokeAllForUser(userId);
    await this.audit.record(
      { userId, businessId: contact.businessId },
      { action: "auth.password.reset", entity: "User", entityId: userId },
    );
  }

  async verifyEmail(token: string): Promise<void> {
    const userId = await this.tokens.consume(hashToken(token), "VERIFY_EMAIL");
    if (!userId) throw badRequest(INVALID_LINK);
    await this.users.markEmailVerified(userId);
  }

  private async issueToken(userId: string, purpose: "RESET_PASSWORD" | "VERIFY_EMAIL", minutes: number) {
    await this.tokens.invalidateAll(userId, purpose);
    const token = newToken();
    await this.tokens.create(userId, purpose, hashToken(token), new Date(Date.now() + minutes * 60_000));
    return token;
  }
}
