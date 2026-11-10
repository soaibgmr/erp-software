import { inject, injectable } from "inversify";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { PERMISSIONS } from "@erp-software/shared";
import { TYPES } from "../../config/ioc.types";
import { env } from "../../config/env";
import { BCRYPT_ROUNDS } from "../../common/constants";
import type { AuthContext } from "../../common/auth-context";
import { badRequest, conflict, fieldErrors, forbidden, notFound, unauthorized } from "../../common/http-error";
import type { Paginated } from "../../common/pagination";
import type { IAuditService } from "../audit/interfaces/iaudit.service";
import type { IBranchRepository } from "../branches/interfaces/ibranch.repository";
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

const INVALID_CREDENTIALS = "Invalid email or password";
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
    @inject(TYPES.AuditService) private readonly audit: IAuditService,
  ) {}

  async login({ email, password }: LoginDto, ip?: string): Promise<AuthResponseDto> {
    const found = await this.users.findCredentialsByEmail(email);
    const valid = await bcrypt.compare(password, found?.passwordHash ?? DUMMY_HASH);

    if (!found || !valid || found.status !== "ACTIVE") {
      throw unauthorized(INVALID_CREDENTIALS);
    }

    await this.users.touchLastLogin(found.id);
    await this.audit.record({ userId: found.id, ip }, { action: "auth.login", entity: "User", entityId: found.id });
    const user = await this.getById(found.id);
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

    const user = await this.users.findById(stored.userId);
    if (!user || user.status !== "ACTIVE") throw unauthorized(INVALID_REFRESH_TOKEN);

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
    const user = await this.getById(auth.userId);
    const branches = await this.branches.list({
      includeInactive: false,
      ids: auth.isOwner ? undefined : auth.branchIds,
    });
    return {
      user,
      isOwner: auth.isOwner,
      permissions: auth.isOwner ? [...PERMISSIONS] : auth.permissions,
      branches: branches.map(({ id, code, name, stateCode, city }) => ({ id, code, name, stateCode, city })),
    };
  }

  async updateMe(auth: AuthContext, input: UpdateProfileDto): Promise<UserResponseDto> {
    const user = await this.users.update(auth.userId, input);
    if (!user) throw notFound("User not found");
    return user;
  }

  async create(auth: AuthContext, { password, ...input }: CreateUserDto): Promise<UserResponseDto> {
    // The unique index also covers soft-deleted rows; the error handler maps P2002 on races.
    if (await this.users.existsByEmail(input.email)) {
      throw conflict("This email is already registered");
    }
    await this.assertCanAssign(auth, input.roleId, input.branchIds);

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.users.create({ ...input, passwordHash });
    await this.audit.record(auth, { action: "user.create", entity: "User", entityId: user.id, after: user });
    return user;
  }

  list(query: ListUsersQuery): Promise<Paginated<UserResponseDto>> {
    return this.users.list(query);
  }

  async getById(id: string): Promise<UserResponseDto> {
    const user = await this.users.findById(id);
    if (!user) throw notFound("User not found");
    return user;
  }

  async update(auth: AuthContext, id: string, input: UpdateUserDto): Promise<UserResponseDto> {
    const before = await this.getById(id);
    const isSelf = id === auth.userId;
    const targetIsOwner = before.role.key === "OWNER";

    if (targetIsOwner && !auth.isOwner) throw forbidden("Only an owner can change an owner's account");
    if (isSelf && input.roleId && input.roleId !== before.role.id) throw badRequest("You cannot change your own role");
    if (isSelf && input.status && input.status !== "ACTIVE") throw badRequest("You cannot deactivate your own account");

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
    if (losesOwnership && (await this.users.countActiveOwners(id)) === 0) {
      throw badRequest("At least one active owner is required");
    }

    const user = await this.users.update(id, input);
    if (!user) throw notFound("User not found");
    if (user.status !== "ACTIVE") await this.refreshTokens.revokeAllForUser(id);

    await this.audit.record(auth, { action: "user.update", entity: "User", entityId: id, before, after: user });
    return user;
  }

  async remove(auth: AuthContext, id: string): Promise<void> {
    if (id === auth.userId) throw badRequest("You cannot delete your own account");
    const before = await this.getById(id);
    if (before.role.key === "OWNER") {
      if (!auth.isOwner) throw forbidden("Only an owner can delete an owner's account");
      if ((await this.users.countActiveOwners(id)) === 0) throw badRequest("At least one active owner is required");
    }

    await this.users.softDelete(id);
    await this.refreshTokens.revokeAllForUser(id);
    await this.audit.record(auth, { action: "user.delete", entity: "User", entityId: id, before });
  }

  // Non-owners can only hand out roles within their own permissions, and only their own branches.
  private async assertCanAssign(auth: AuthContext, roleId: string, branchIds: string[]): Promise<RoleResponseDto> {
    const role = await this.roles.findById(roleId);
    if (!role) throw fieldErrors([{ path: "roleId", message: "Role not found" }]);

    const uniqueBranchIds = [...new Set(branchIds)];
    const found = await this.branches.findManyByIds(uniqueBranchIds);
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
