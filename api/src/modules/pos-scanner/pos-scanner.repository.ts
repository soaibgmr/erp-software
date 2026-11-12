import { inject, injectable } from "inversify";
import { PrismaClient } from "@prisma/client";
import { TYPES } from "../../config/ioc.types";
import type { IPosScannerRepository } from "./interfaces/ipos-scanner.repository";
import type { CreateScanSessionData, ScanEventDto, ScanSessionRow } from "./pos-scanner.types";

const sessionSelect = {
  id: true,
  businessId: true,
  branchId: true,
  userId: true,
  tokenHash: true,
  expiresAt: true,
  closedAt: true,
  phoneSeenAt: true,
} as const;

@injectable()
export class PosScannerRepository implements IPosScannerRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  create(data: CreateScanSessionData): Promise<ScanSessionRow> {
    return this.prisma.posScanSession.create({ data, select: sessionSelect });
  }

  findById(id: string): Promise<ScanSessionRow | null> {
    return this.prisma.posScanSession.findUnique({ where: { id }, select: sessionSelect });
  }

  async closeOpenFor(userId: string, branchId: string, now: Date): Promise<void> {
    await this.prisma.posScanSession.updateMany({
      where: { userId, branchId, closedAt: null },
      data: { closedAt: now },
    });
  }

  async close(id: string, now: Date): Promise<void> {
    await this.prisma.posScanSession.updateMany({ where: { id, closedAt: null }, data: { closedAt: now } });
  }

  async markPhoneSeen(id: string, now: Date): Promise<void> {
    await this.prisma.posScanSession.update({ where: { id }, data: { phoneSeenAt: now } });
  }

  async deleteExpired(before: Date): Promise<number> {
    const { count } = await this.prisma.posScanSession.deleteMany({ where: { expiresAt: { lt: before } } });
    return count;
  }

  async addScan(sessionId: string, code: string, now: Date): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.posScanEvent.create({ data: { sessionId, code, createdAt: now } }),
      this.prisma.posScanSession.update({ where: { id: sessionId }, data: { phoneSeenAt: now } }),
    ]);
  }

  async listScans(sessionId: string, after: bigint | null, limit: number): Promise<ScanEventDto[]> {
    const rows = await this.prisma.posScanEvent.findMany({
      where: { sessionId, ...(after !== null && { id: { gt: after } }) },
      orderBy: { id: "asc" },
      take: limit,
      select: { id: true, code: true },
    });
    return rows.map((r) => ({ id: r.id.toString(), code: r.code }));
  }

  async findShopInfo(businessId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, businessId, deletedAt: null },
      select: { name: true, business: { select: { legalName: true, tradeName: true, status: true } } },
    });
    if (!branch) return null;
    return {
      shopName: branch.business.tradeName ?? branch.business.legalName,
      branchName: branch.name,
      status: branch.business.status,
    };
  }
}
