import { inject, injectable } from "inversify";
import { Prisma, PrismaClient } from "@prisma/client";
import { TYPES } from "../../config/ioc.types";
import type { IRoleRepository } from "./interfaces/irole.repository";
import type { CreateRoleDto, RoleResponseDto, UpdateRoleDto } from "./role.types";

const roleSelect = {
  id: true,
  key: true,
  name: true,
  description: true,
  permissions: true,
  isSystem: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { users: { where: { deletedAt: null } } } },
} satisfies Prisma.RoleSelect;

type RoleRow = Prisma.RoleGetPayload<{ select: typeof roleSelect }>;

const toDto = ({ _count, ...role }: RoleRow): RoleResponseDto => ({ ...role, userCount: _count.users });

@injectable()
export class RoleRepository implements IRoleRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  async findById(businessId: string, id: string): Promise<RoleResponseDto | null> {
    const row = await this.prisma.role.findFirst({ where: { id, businessId, deletedAt: null }, select: roleSelect });
    return row && toDto(row);
  }

  async findByKey(businessId: string, key: string): Promise<RoleResponseDto | null> {
    const row = await this.prisma.role.findFirst({ where: { key, businessId, deletedAt: null }, select: roleSelect });
    return row && toDto(row);
  }

  async existsByName(businessId: string, name: string, excludeId?: string): Promise<boolean> {
    const found = await this.prisma.role.findFirst({
      where: {
        businessId,
        name: { equals: name, mode: "insensitive" },
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { id: true },
    });
    return found !== null;
  }

  async list(businessId: string): Promise<RoleResponseDto[]> {
    const rows = await this.prisma.role.findMany({
      where: { businessId, deletedAt: null },
      select: roleSelect,
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
    return rows.map(toDto);
  }

  async create(businessId: string, data: CreateRoleDto): Promise<RoleResponseDto> {
    return toDto(await this.prisma.role.create({ data: { ...data, businessId }, select: roleSelect }));
  }

  async update(businessId: string, id: string, data: UpdateRoleDto): Promise<RoleResponseDto | null> {
    const { count } = await this.prisma.role.updateMany({ where: { id, businessId, deletedAt: null }, data });
    if (count === 0) return null;
    return this.findById(businessId, id);
  }

  async softDelete(businessId: string, id: string): Promise<boolean> {
    const { count } = await this.prisma.role.updateMany({
      where: { id, businessId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return count > 0;
  }
}
