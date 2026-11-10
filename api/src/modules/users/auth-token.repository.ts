import { inject, injectable } from "inversify";
import { PrismaClient, type AuthTokenPurpose } from "@prisma/client";
import { TYPES } from "../../config/ioc.types";
import type { IAuthTokenRepository } from "./interfaces/iauth-token.repository";

@injectable()
export class AuthTokenRepository implements IAuthTokenRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  async create(userId: string, purpose: AuthTokenPurpose, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.prisma.authToken.create({ data: { userId, purpose, tokenHash, expiresAt } });
  }

  async consume(tokenHash: string, purpose: AuthTokenPurpose): Promise<string | null> {
    // Conditional update: of two concurrent uses, only one sees count = 1.
    const { count } = await this.prisma.authToken.updateMany({
      where: { tokenHash, purpose, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (count === 0) return null;
    const row = await this.prisma.authToken.findUnique({ where: { tokenHash }, select: { userId: true } });
    return row?.userId ?? null;
  }

  async invalidateAll(userId: string, purpose: AuthTokenPurpose): Promise<void> {
    await this.prisma.authToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}
