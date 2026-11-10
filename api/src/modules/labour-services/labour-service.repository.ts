import { inject, injectable } from "inversify";
import { Prisma, PrismaClient } from "@prisma/client";
import { TYPES } from "../../config/ioc.types";
import type { Paginated } from "../../common/pagination";
import type { ILabourServiceRepository } from "./interfaces/ilabour-service.repository";
import type {
  CreateLabourServiceDto,
  LabourServiceResponseDto,
  ListLabourServicesQuery,
  UpdateLabourServiceDto,
} from "./labour-service.types";

const select = {
  id: true,
  code: true,
  name: true,
  sacCode: true,
  gstRate: true,
  rate: true,
  standardHours: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LabourServiceSelect;

type Row = Prisma.LabourServiceGetPayload<{ select: typeof select }>;

const toDto = (r: Row): LabourServiceResponseDto => ({
  ...r,
  gstRate: Number(r.gstRate),
  rate: r.rate.toFixed(2),
  standardHours: r.standardHours.toFixed(2),
});

@injectable()
export class LabourServiceRepository implements ILabourServiceRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  async findById(businessId: string, id: string): Promise<LabourServiceResponseDto | null> {
    const row = await this.prisma.labourService.findFirst({ where: { id, businessId, deletedAt: null }, select });
    return row && toDto(row);
  }

  findByName(businessId: string, name: string, excludeId?: string) {
    return this.prisma.labourService.findFirst({
      where: {
        businessId,
        deletedAt: null,
        name: { equals: name, mode: "insensitive" },
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { id: true },
    });
  }

  async list(
    businessId: string,
    { page, limit, search, isActive }: ListLabourServicesQuery,
  ): Promise<Paginated<LabourServiceResponseDto>> {
    const where: Prisma.LabourServiceWhereInput = {
      businessId,
      deletedAt: null,
      isActive,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { code: { startsWith: search, mode: "insensitive" } },
          { sacCode: { startsWith: search } },
        ],
      }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.labourService.findMany({
        where,
        select,
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.labourService.count({ where }),
    ]);
    return { data: rows.map(toDto), page, limit, total };
  }

  async create(businessId: string, data: CreateLabourServiceDto): Promise<LabourServiceResponseDto> {
    return toDto(await this.prisma.labourService.create({ data: { ...data, businessId }, select }));
  }

  async update(businessId: string, id: string, data: UpdateLabourServiceDto): Promise<LabourServiceResponseDto | null> {
    const { count } = await this.prisma.labourService.updateMany({ where: { id, businessId, deletedAt: null }, data });
    return count ? this.findById(businessId, id) : null;
  }

  async softDelete(businessId: string, id: string): Promise<boolean> {
    const { count } = await this.prisma.labourService.updateMany({
      where: { id, businessId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return count > 0;
  }
}
