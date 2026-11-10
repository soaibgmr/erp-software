import { inject, injectable } from "inversify";
import { Prisma, PrismaClient } from "@prisma/client";
import { TYPES } from "../../config/ioc.types";
import type { Paginated } from "../../common/pagination";
import type { Db } from "../../common/prisma-types";
import type { IAuditRepository } from "./interfaces/iaudit.repository";
import type { AuditLogResponseDto, CreateAuditLogData, ListAuditLogsQuery } from "./audit.types";

const auditSelect = {
  id: true,
  action: true,
  entity: true,
  entityId: true,
  branchId: true,
  before: true,
  after: true,
  ip: true,
  createdAt: true,
  actor: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.AuditLogSelect;

@injectable()
export class AuditRepository implements IAuditRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  async create(data: CreateAuditLogData, db: Db = this.prisma): Promise<void> {
    await db.auditLog.create({ data });
  }

  async list(
    businessId: string,
    { page, limit, entity, entityId, actorId, action, from, to }: ListAuditLogsQuery,
  ): Promise<Paginated<AuditLogResponseDto>> {
    const where: Prisma.AuditLogWhereInput = {
      businessId,
      entity,
      entityId,
      actorId,
      ...(action && { action: { startsWith: action } }),
      ...((from || to) && { createdAt: { gte: from, lte: to } }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        select: auditSelect,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, page, limit, total };
  }
}
