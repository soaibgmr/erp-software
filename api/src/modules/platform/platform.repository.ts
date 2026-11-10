import { inject, injectable } from "inversify";
import { Prisma, PrismaClient, type BusinessStatus } from "@prisma/client";
import { TYPES } from "../../config/ioc.types";
import type { Paginated } from "../../common/pagination";
import type { IPlatformRepository } from "./interfaces/iplatform.repository";
import type { ListBusinessesQuery, OwnerContact, PlatformAdminDto, PlatformBusinessDto } from "./platform.types";

const ownerWhere = { deletedAt: null, role: { key: "OWNER" } } satisfies Prisma.UserWhereInput;

const businessSelect = {
  id: true,
  legalName: true,
  tradeName: true,
  city: true,
  stateCode: true,
  gstin: true,
  status: true,
  statusNote: true,
  approvedAt: true,
  createdAt: true,
  users: {
    where: ownerWhere,
    orderBy: { createdAt: "asc" },
    take: 1,
    select: { firstName: true, lastName: true, mobile: true, email: true, emailVerifiedAt: true },
  },
  _count: {
    select: {
      branches: { where: { deletedAt: null } },
      users: { where: { deletedAt: null } },
    },
  },
} satisfies Prisma.BusinessSelect;

type BusinessRow = Prisma.BusinessGetPayload<{ select: typeof businessSelect }>;

const toDto = (r: BusinessRow): PlatformBusinessDto => {
  const owner = r.users[0];
  return {
    id: r.id,
    name: r.tradeName ?? r.legalName,
    legalName: r.legalName,
    city: r.city,
    stateCode: r.stateCode,
    gstin: r.gstin,
    status: r.status,
    statusNote: r.statusNote,
    approvedAt: r.approvedAt,
    createdAt: r.createdAt,
    owner: owner
      ? {
          name: `${owner.firstName} ${owner.lastName}`.trim(),
          mobile: owner.mobile,
          email: owner.email,
          emailVerified: owner.emailVerifiedAt !== null,
        }
      : null,
    branchCount: r._count.branches,
    userCount: r._count.users,
  };
};

@injectable()
export class PlatformRepository implements IPlatformRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  findAdminCredentials(email: string) {
    return this.prisma.platformAdmin.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, passwordHash: true },
    });
  }

  findAdmin(id: string): Promise<PlatformAdminDto | null> {
    return this.prisma.platformAdmin.findUnique({ where: { id }, select: { id: true, name: true, email: true } });
  }

  async touchAdminLogin(id: string): Promise<void> {
    await this.prisma.platformAdmin.update({ where: { id }, data: { lastLoginAt: new Date() } });
  }

  async listBusinesses({ page, limit, status, search }: ListBusinessesQuery): Promise<Paginated<PlatformBusinessDto>> {
    const where: Prisma.BusinessWhereInput = {
      status,
      ...(search && {
        OR: [
          { legalName: { contains: search, mode: "insensitive" } },
          { tradeName: { contains: search, mode: "insensitive" } },
          { city: { contains: search, mode: "insensitive" } },
          { gstin: { startsWith: search.toUpperCase() } },
          { users: { some: { ...ownerWhere, mobile: { contains: search.replace(/\D/g, "") || search } } } },
          { users: { some: { ...ownerWhere, email: { contains: search, mode: "insensitive" } } } },
        ],
      }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.business.findMany({
        where,
        select: businessSelect,
        // Shops waiting for approval first, newest first within each status.
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.business.count({ where }),
    ]);
    return { data: rows.map(toDto), page, limit, total };
  }

  async findBusiness(id: string): Promise<PlatformBusinessDto | null> {
    const row = await this.prisma.business.findUnique({ where: { id }, select: businessSelect });
    return row && toDto(row);
  }

  async setBusinessStatus(id: string, status: BusinessStatus, note: string | null): Promise<void> {
    await this.prisma.business.update({
      where: { id },
      data: {
        status,
        statusNote: note,
        ...(status === "ACTIVE" && { approvedAt: new Date() }),
      },
    });
  }

  findOwnerContact(businessId: string): Promise<OwnerContact | null> {
    return this.prisma.user.findFirst({
      where: { businessId, ...ownerWhere, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: { firstName: true, email: true },
    });
  }
}
