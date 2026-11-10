import { inject, injectable } from "inversify";
import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { isPermission, type Permission } from "@erp-software/shared";
import { TYPES } from "../config/ioc.types";
import { env } from "../config/env";
import { badRequest, forbidden, unauthorized } from "../common/http-error";
import { assertBusinessActive, PLATFORM_AUDIENCE } from "../common/tenant";
import { canAccessBranch, type AuthContext } from "../common/auth-context";
import type { IUserRepository } from "../modules/users/interfaces/iuser.repository";
import type { IBranchRepository } from "../modules/branches/interfaces/ibranch.repository";

export const BRANCH_HEADER = "x-branch-id";
const uuid = z.uuid();

@injectable()
export class AuthMiddleware {
  constructor(
    @inject(TYPES.UserRepository) private readonly users: IUserRepository,
    @inject(TYPES.BranchRepository) private readonly branches: IBranchRepository,
  ) {}

  // Verifies the bearer token and sets res.locals.auth.
  requireAuth: RequestHandler = async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw unauthorized();

    let userId: string;
    try {
      const payload = jwt.verify(header.slice(7), env.JWT_SECRET);
      if (typeof payload === "string" || !payload.sub) throw new Error("Invalid payload");
      // Platform-admin tokens never open shop data.
      if (payload.aud === PLATFORM_AUDIENCE) throw new Error("Wrong audience");
      userId = payload.sub;
    } catch {
      throw unauthorized("Invalid or expired token");
    }

    // Re-read the user so deactivation, role and branch changes take effect immediately.
    const user = await this.users.findAuthUser(userId);
    if (!user || user.status !== "ACTIVE") throw unauthorized();
    assertBusinessActive(user.businessStatus);

    res.locals.auth = {
      userId: user.id,
      businessId: user.businessId,
      roleId: user.role.id,
      roleKey: user.role.key,
      isOwner: user.role.key === "OWNER",
      permissions: user.role.permissions.filter(isPermission),
      branchIds: user.branchIds,
      ip: req.ip,
    } satisfies AuthContext;
    next();
  };

  // Passes when the user has any of the given permissions. Owners always pass.
  requirePermission =
    (...permissions: Permission[]): RequestHandler =>
    (_req, res, next) => {
      const auth = res.locals.auth as AuthContext | undefined;
      if (!auth) throw unauthorized();
      if (!auth.isOwner && !permissions.some((p) => auth.permissions.includes(p))) {
        throw forbidden(`You don't have permission for this action (${permissions.join(" or ")})`);
      }
      next();
    };

  // Resolves the x-branch-id header into res.locals.branchId after checking the user may work there.
  requireBranch: RequestHandler = async (req, res, next) => {
    res.locals.branchId = await this.resolveBranch(req.headers[BRANCH_HEADER], res.locals.auth, true);
    next();
  };

  optionalBranch: RequestHandler = async (req, res, next) => {
    res.locals.branchId = await this.resolveBranch(req.headers[BRANCH_HEADER], res.locals.auth, false);
    next();
  };

  private async resolveBranch(header: string | string[] | undefined, auth: AuthContext | undefined, required: boolean) {
    if (!auth) throw unauthorized();
    const value = Array.isArray(header) ? header[0] : header;
    if (!value) {
      if (required) throw badRequest(`The ${BRANCH_HEADER} header is required`);
      return undefined;
    }
    if (!uuid.safeParse(value).success) throw badRequest(`Invalid ${BRANCH_HEADER} header`);
    if (!canAccessBranch(auth, value)) throw forbidden("You don't have access to this branch");

    const branch = await this.branches.findById(auth.businessId, value);
    if (!branch || !branch.isActive) throw forbidden("Branch not found or inactive");
    return value;
  }
}
