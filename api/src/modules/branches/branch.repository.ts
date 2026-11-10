import { inject, injectable } from "inversify";
import { Prisma, PrismaClient } from "@prisma/client";
import { TYPES } from "../../config/ioc.types";
import type { IBranchRepository } from "./interfaces/ibranch.repository";
import type { BranchListFilter, BranchResponseDto, CreateBranchDto, UpdateBranchDto } from "./branch.types";

const branchSelect = {
  id: true,
  code: true,
  name: true,
  address: true,
  city: true,
  pincode: true,
  stateCode: true,
  gstin: true,
  phone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BranchSelect;

type Db = PrismaClient | Prisma.TransactionClient;

@injectable()
export class BranchRepository implements IBranchRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  findById(businessId: string, id: string): Promise<BranchResponseDto | null> {
    return this.prisma.branch.findFirst({ where: { id, businessId, deletedAt: null }, select: branchSelect });
  }

  async existsByCode(businessId: string, code: string, excludeId?: string): Promise<boolean> {
    const found = await this.prisma.branch.findFirst({
      where: { businessId, code, ...(excludeId && { id: { not: excludeId } }) },
      select: { id: true },
    });
    return found !== null;
  }

  findManyByIds(businessId: string, ids: string[]): Promise<BranchResponseDto[]> {
    return this.prisma.branch.findMany({
      where: { id: { in: ids }, businessId, deletedAt: null },
      select: branchSelect,
    });
  }

  list(businessId: string, { ids, includeInactive, search }: BranchListFilter): Promise<BranchResponseDto[]> {
    return this.prisma.branch.findMany({
      where: {
        businessId,
        deletedAt: null,
        ...(ids && { id: { in: ids } }),
        ...(!includeInactive && { isActive: true }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { code: { contains: search, mode: "insensitive" } },
            { city: { contains: search, mode: "insensitive" } },
          ],
        }),
      },
      select: branchSelect,
      orderBy: { name: "asc" },
    });
  }

  countActive(businessId: string): Promise<number> {
    return this.prisma.branch.count({ where: { businessId, deletedAt: null, isActive: true } });
  }

  create(businessId: string, data: CreateBranchDto, db: Db = this.prisma): Promise<BranchResponseDto> {
    return db.branch.create({ data: { ...data, businessId }, select: branchSelect });
  }

  async update(businessId: string, id: string, data: UpdateBranchDto): Promise<BranchResponseDto | null> {
    const { count } = await this.prisma.branch.updateMany({ where: { id, businessId, deletedAt: null }, data });
    if (count === 0) return null;
    return this.findById(businessId, id);
  }

  async softDelete(businessId: string, id: string): Promise<boolean> {
    const { count } = await this.prisma.branch.updateMany({
      where: { id, businessId, deletedAt: null },
      data: { deletedAt: new Date(), isActive: false },
    });
    return count > 0;
  }
}
