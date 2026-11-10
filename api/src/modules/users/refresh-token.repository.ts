import { inject, injectable } from "inversify";
import { PrismaClient } from "@prisma/client";
import { TYPES } from "../../config/ioc.types";
import type { IRefreshTokenRepository } from "./interfaces/irefresh-token.repository";
import type { CreateRefreshTokenData, RefreshTokenRecord } from "./user.types";

@injectable()
export class RefreshTokenRepository implements IRefreshTokenRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  async create(data: CreateRefreshTokenData): Promise<void> {
    await this.prisma.refreshToken.create({ data });
  }

  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, revokedAt: true },
    });
  }

  async revokeIfActive(id: string): Promise<boolean> {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count > 0;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
