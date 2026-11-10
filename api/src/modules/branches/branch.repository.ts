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

@injectable()
export class BranchRepository implements IBranchRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  findById(id: string): Promise<BranchResponseDto | null> {
    return this.prisma.branch.findFirst({ where: { id, deletedAt: null }, select: branchSelect });
  }

  async existsByCode(code: string, excludeId?: string): Promise<boolean> {
    const found = await this.prisma.branch.findFirst({
      where: { code, ...(excludeId && { id: { not: excludeId } }) },
      select: { id: true },
    });
    return found !== null;
  }

  findManyByIds(ids: string[]): Promise<BranchResponseDto[]> {
    return this.prisma.branch.findMany({ where: { id: { in: ids }, deletedAt: null }, select: branchSelect });
  }

  list({ ids, includeInactive, search }: BranchListFilter): Promise<BranchResponseDto[]> {
    return this.prisma.branch.findMany({
      where: {
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

  countActive(): Promise<number> {
    return this.prisma.branch.count({ where: { deletedAt: null, isActive: true } });
  }

  create(data: CreateBranchDto): Promise<BranchResponseDto> {
    return this.prisma.branch.create({ data, select: branchSelect });
  }

  async update(id: string, data: UpdateBranchDto): Promise<BranchResponseDto | null> {
    const { count } = await this.prisma.branch.updateMany({ where: { id, deletedAt: null }, data });
    if (count === 0) return null;
    return this.findById(id);
  }

  async softDelete(id: string): Promise<boolean> {
    const { count } = await this.prisma.branch.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date(), isActive: false },
    });
    return count > 0;
  }
}
