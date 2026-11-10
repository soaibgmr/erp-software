import { inject, injectable } from "inversify";
import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { TYPES } from "../config/ioc.types";
import { env } from "../config/env";
import { unauthorized } from "../common/http-error";
import { PLATFORM_AUDIENCE } from "../common/tenant";
import type { IPlatformRepository } from "../modules/platform/interfaces/iplatform.repository";
import type { PlatformAdminContext } from "../modules/platform/platform.types";

// Guards /platform routes: only tokens issued to a platform admin (audience "platform") pass.
// Shop users' tokens have no audience and are rejected here, just as platform tokens are rejected by requireAuth.
@injectable()
export class PlatformAuthMiddleware {
  constructor(@inject(TYPES.PlatformRepository) private readonly platform: IPlatformRepository) {}

  requirePlatformAdmin: RequestHandler = async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw unauthorized();

    let adminId: string;
    try {
      const payload = jwt.verify(header.slice(7), env.JWT_SECRET, { audience: PLATFORM_AUDIENCE });
      if (typeof payload === "string" || !payload.sub) throw new Error("Invalid payload");
      adminId = payload.sub;
    } catch {
      throw unauthorized("Invalid or expired token");
    }

    const admin = await this.platform.findAdmin(adminId);
    if (!admin) throw unauthorized();
    res.locals.platformAdmin = { adminId: admin.id, email: admin.email, ip: req.ip } satisfies PlatformAdminContext;
    next();
  };
}
