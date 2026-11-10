import { inject, injectable } from "inversify";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { PERMISSIONS } from "@erp-software/shared";
import { TYPES } from "../../config/ioc.types";
import { env } from "../../config/env";
import { BCRYPT_ROUNDS } from "../../common/constants";
import type { AuthContext } from "../../common/auth-context";
import { badRequest, fieldErrors, forbidden, notFound, unauthorized } from "../../common/http-error";
import type { Paginated } from "../../common/pagination";
import { ACCOUNT_LOCK, assertNotLocked, type IAttemptLimiter } from "../../common/attempt-limiter";
import type { IAuditService } from "../audit/interfaces/iaudit.service";
import type { IBranchRepository } from "../branches/interfaces/ibranch.repository";
import type { IBusinessRepository } from "../business/interfaces/ibusiness.repository";
import { assertBusinessActive } from "../../common/tenant";
import type { IRoleRepository } from "../roles/interfaces/irole.repository";
import type { RoleResponseDto } from "../roles/role.types";
import type { IRefreshTokenRepository } from "./interfaces/irefresh-token.repository";
import type { IUserRepository } from "./interfaces/iuser.repository";
import type { IUserService } from "./interfaces/iuser.service";
import type {
  AuthResponseDto,
  ChangePasswordDto,
  CreateUserDto,
  ListUsersQuery,
  LoginDto,
  MeResponseDto,
  TokenPair,
  UpdateProfileDto,
  UpdateUserDto,
  UserResponseDto,
} from "./user.types";

// Compared against when the email is unknown so login takes the same time either way.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", BCRYPT_ROUNDS);

const INVALID_CREDENTIALS = "Username or password is incorrect";
const INVALID_REFRESH_TOKEN = "Invalid or expired refresh token";

const DAY_MS = 24 * 60 * 60 * 1000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

@injectable()
export class UserService implements IUserService {
  constructor(
    @inject(TYPES.UserRepository) private readonly users: IUserRepository,
    @inject(TYPES.RefreshTokenRepository) private readonly refreshTokens: IRefreshTokenRepository,
    @inject(TYPES.RoleRepository) private readonly roles: IRoleRepository,
    @inject(TYPES.BranchRepository) private readonly branches: IBranchRepository,
    @inject(TYPES.BusinessRepository) private readonly business: IBusinessRepository,
    @inject(TYPES.AuditService) private readonly audit: IAuditService,
    @inject(TYPES.AttemptLimiter) private readonly limiter: IAttemptLimiter,
  ) {}

  async login({ identifier, password }: LoginDto, ip?: string): Promise<AuthResponseDto> {
    // Locks the identifier (known account or not, so the lock reveals nothing) after repeated wrong passwords.
    const lockKey = `login:${identifier.trim().toLowerCase()}`;
    await assertNotLocked(this.limiter, lockKey);
    const found = await this.users.findCredentialsByIdentifier(identifier);
    const valid = await bcrypt.compare(password, found?.passwordHash ?? DUMMY_HASH);

    if (!found || !valid || found.status !== "ACTIVE") {
      await this.limiter.hit(lockKey, ACCOUNT_LOCK.windowMs);
      throw unauthorized(INVALID_CREDENTIALS);
    }
    await this.limiter.reset(lockKey);
    // Only after the password matched, so the shop's status is not revealed to strangers.
    assertBusinessActive(found.businessStatus);

    await this.users.touchLastLogin(found.id);
    await this.audit.record(
      { userId: found.id, businessId: found.businessId, ip },
      { action: "auth.login", entity: "User", entityId: found.id },
    );
    const user = await this.getById(found.businessId, found.id);
    return { user, ...(await this.issueTokens(user.id)) };
  }

  // Rotates the refresh token: the presented one is revoked and a new pair is issued.
  async refresh(refreshToken: string): Promise<TokenPair> {
    const stored = await this.refreshTokens.findByHash(hashToken(refreshToken));
    if (!stored) throw unauthorized(INVALID_REFRESH_TOKEN);

    // A revoked token being presented again means it may have been stolen: end every session.
    if (stored.revokedAt || !(await this.refreshTokens.revokeIfActive(stored.id))) {
      await this.refreshTokens.revokeAllForUser(stored.userId);
      throw unauthorized(INVALID_REFRESH_TOKEN);
    }
    if (stored.expiresAt <= new Date()) throw unauthorized(INVALID_REFRESH_TOKEN);

    const user = await this.users.findCredentialsById(stored.userId);
    if (!user || user.status !== "ACTIVE") throw unauthorized(INVALID_REFRESH_TOKEN);
    assertBusinessActive(user.businessStatus);

    return this.issueTokens(user.id);
  }

  // Always succeeds so the response doesn't reveal whether the token was valid.
  async logout(refreshToken: string): Promise<void> {
    const stored = await this.refreshTokens.findByHash(hashToken(refreshToken));
    if (stored) await this.refreshTokens.revokeIfActive(stored.id);
  }

  async changePassword(auth: AuthContext, { currentPassword, newPassword }: ChangePasswordDto): Promise<void> {
    const found = await this.users.findCredentialsById(auth.userId);
    if (!found) throw notFound("User not found");

    if (!(await bcrypt.compare(currentPassword, found.passwordHash))) {
      throw fieldErrors([{ path: "currentPassword", message: "Current password is incorrect" }]);
    }
    if (currentPassword === newPassword) {
      throw fieldErrors([{ path: "newPassword", message: "New password must be different from the current password" }]);
    }

    await this.users.updatePasswordHash(auth.userId, await bcrypt.hash(newPassword, BCRYPT_ROUNDS));
    // Sign out every other session; existing access tokens expire on their own.
    await this.refreshTokens.revokeAllForUser(auth.userId);
  }

  async getMe(auth: AuthContext): Promise<MeResponseDto> {
    const [user, branches, business] = await Promise.all([
      this.getById(auth.businessId, auth.userId),
      this.branches.list(auth.businessId, { includeInactive: false, ids: auth.branchIds }),
      this.business.getSummary(auth.businessId),
    ]);
    if (!business) throw notFound("Business not found");
    return {
      user,
      business,
      isOwner: auth.isOwner,
      permissions: auth.isOwner ? [...PERMISSIONS] : auth.permissions,
      branches: branches.map(({ id, code, name, stateCode, city }) => ({ id, code, name, stateCode, city })),
    };
  }

  async updateMe(auth: AuthContext, input: UpdateProfileDto): Promise<UserResponseDto> {
    const user = await this.users.update(auth.businessId, auth.userId, input);
    if (!user) throw notFound("User not found");
    return user;
  }

  async create(auth: AuthContext, { password, ...input }: CreateUserDto): Promise<UserResponseDto> {
    await this.assertContactFree(input.mobile, input.email);
    await this.assertCanAssign(auth, input.roleId, input.branchIds);

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.users.create(auth.businessId, { ...input, passwordHash });
    await this.audit.record(auth, { action: "user.create", entity: "User", entityId: user.id, after: user });
    return user;
  }

  list(auth: AuthContext, query: ListUsersQuery): Promise<Paginated<UserResponseDto>> {
    return this.users.list(auth.businessId, query);
  }

  async getById(businessId: string, id: string): Promise<UserResponseDto> {
    const user = await this.users.findById(businessId, id);
    if (!user) throw notFound("User not found");
    return user;
  }

  async update(auth: AuthContext, id: string, input: UpdateUserDto): Promise<UserResponseDto> {
    const before = await this.getById(auth.businessId, id);
    const isSelf = id === auth.userId;
    const targetIsOwner = before.role.key === "OWNER";

    if (targetIsOwner && !auth.isOwner) throw forbidden("Only an owner can change an owner's account");
    if (!isSelf) await this.assertCanManage(auth, before);
    if (isSelf && input.roleId && input.roleId !== before.role.id) throw badRequest("You cannot change your own role");
    if (isSelf && input.status && input.status !== "ACTIVE") throw badRequest("You cannot deactivate your own account");

    await this.assertContactFree(input.mobile, input.email, id);
    if (input.email !== undefined && input.email !== before.email) {
      // A changed email has to be verified again before reset links go to it.
      (input as UpdateUserDto & { emailVerifiedAt?: Date | null }).emailVerifiedAt = null;
    }

    if (input.roleId !== undefined || input.branchIds !== undefined) {
      await this.assertCanAssign(
        auth,
        input.roleId ?? before.role.id,
        input.branchIds ?? before.branches.map((b) => b.id),
      );
    }

    // Keep at least one active owner, or nobody could manage the system.
    const losesOwnership =
      targetIsOwner &&
      before.status === "ACTIVE" &&
      ((input.status && input.status !== "ACTIVE") || (input.roleId && input.roleId !== before.role.id));
    if (losesOwnership && (await this.users.countActiveOwners(auth.businessId, id)) === 0) {
      throw badRequest("At least one active owner is required");
    }

    const user = await this.users.update(auth.businessId, id, input);
    if (!user) throw notFound("User not found");
    if (user.status !== "ACTIVE") await this.refreshTokens.revokeAllForUser(id);

    await this.audit.record(auth, { action: "user.update", entity: "User", entityId: id, before, after: user });
    return user;
  }

  // An owner or manager sets a new temporary password for a staff member (staff often have no email to reset it).
  async setPassword(auth: AuthContext, id: string, password: string): Promise<void> {
    if (id === auth.userId) throw badRequest("Change your own password from My profile");
    const target = await this.getById(auth.businessId, id);
    if (target.role.key === "OWNER" && !auth.isOwner) throw forbidden("Only an owner can change an owner's password");
    await this.assertCanManage(auth, target);
    await this.users.updatePasswordHash(id, await bcrypt.hash(password, BCRYPT_ROUNDS));
    // Signs them out everywhere, so the old password stops working on every device.
    await this.refreshTokens.revokeAllForUser(id);
    await this.audit.record(auth, { action: "user.password.set", entity: "User", entityId: id });
  }

  async remove(auth: AuthContext, id: string): Promise<void> {
    if (id === auth.userId) throw badRequest("You cannot delete your own account");
    const before = await this.getById(auth.businessId, id);
    if (before.role.key === "OWNER") {
      if (!auth.isOwner) throw forbidden("Only an owner can delete an owner's account");
      if ((await this.users.countActiveOwners(auth.businessId, id)) === 0) {
        throw badRequest("At least one active owner is required");
      }
    }
    await this.assertCanManage(auth, before);

    await this.users.softDelete(auth.businessId, id);
    await this.refreshTokens.revokeAllForUser(id);
    await this.audit.record(auth, { action: "user.delete", entity: "User", entityId: id, before });
  }

  // A non-owner may only manage users who share one of their branches and whose role is within their own
  // permissions; otherwise they could change a stronger user's email or password and sign in as them.
  private async assertCanManage(auth: AuthContext, target: UserResponseDto): Promise<void> {
    if (auth.isOwner) return;
    if (!target.branches.some((b) => auth.branchIds.includes(b.id))) {
      throw forbidden("You can only manage users in your branches");
    }
    const role = await this.roles.findById(auth.businessId, target.role.id);
    const missing = (role?.permissions ?? []).filter((p) => !(auth.permissions as string[]).includes(p));
    if (!role || missing.length) throw forbidden("This user has permissions you don't have");
  }

  // Non-owners can only hand out roles within their own permissions, and only their own branches.
  private async assertCanAssign(auth: AuthContext, roleId: string, branchIds: string[]): Promise<RoleResponseDto> {
    const role = await this.roles.findById(auth.businessId, roleId);
    if (!role) throw fieldErrors([{ path: "roleId", message: "Role not found" }]);

    const uniqueBranchIds = [...new Set(branchIds)];
    const found = await this.branches.findManyByIds(auth.businessId, uniqueBranchIds);
    if (found.length !== uniqueBranchIds.length) throw fieldErrors([{ path: "branchIds", message: "Unknown branch" }]);

    if (role.key !== "OWNER" && uniqueBranchIds.length === 0) {
      throw fieldErrors([{ path: "branchIds", message: "Assign at least one branch" }]);
    }

    if (!auth.isOwner) {
      if (role.key === "OWNER") throw forbidden("Only an owner can assign the Owner role");
      const missing = role.permissions.filter((p) => !(auth.permissions as string[]).includes(p));
      if (missing.length) throw forbidden(`This role has permissions you don't have: ${missing.join(", ")}`);
      if (uniqueBranchIds.some((b) => !auth.branchIds.includes(b))) {
        throw forbidden("You can only assign branches you have access to");
      }
    }
    return role;
  }

  // Mobile and email identify a person across every company, so they must be free everywhere.
  // The unique indexes also cover soft-deleted rows; the error handler maps P2002 on races.
  private async assertContactFree(mobile?: string | null, email?: string | null, excludeId?: string) {
    if (mobile && (await this.users.existsByMobile(mobile, excludeId))) {
      throw fieldErrors([{ path: "mobile", message: "This mobile number is already registered" }]);
    }
    if (email && (await this.users.existsByEmail(email, excludeId))) {
      throw fieldErrors([{ path: "email", message: "This email is already registered" }]);
    }
  }

  private async issueTokens(userId: string): Promise<TokenPair> {
    const refreshToken = randomBytes(48).toString("base64url");
    await this.refreshTokens.create({
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * DAY_MS),
    });
    const token = jwt.sign({}, env.JWT_SECRET, {
      subject: userId,
      expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    });
    return { token, refreshToken };
  }
}
