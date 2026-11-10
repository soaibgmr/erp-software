import { inject, injectable } from "inversify";
import { Prisma, PrismaClient } from "@prisma/client";
import { TYPES } from "../../config/ioc.types";
import type { Paginated } from "../../common/pagination";
import type { IUserRepository } from "./interfaces/iuser.repository";
import type {
  AuthUserRecord,
  CreateUserData,
  ListUsersQuery,
  UpdateUserData,
  UserCredentials,
  UserResponseDto,
} from "./user.types";

// Whitelist of columns safe to return; keeps passwordHash out of every query by default.
const publicUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, key: true, name: true } },
  branches: {
    where: { branch: { deletedAt: null } },
    select: { branch: { select: { id: true, code: true, name: true } } },
    orderBy: { branch: { name: "asc" } },
  },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

const toDto = ({ branches, ...user }: UserRow): UserResponseDto => ({
  ...user,
  branches: branches.map((b) => b.branch),
});

const credentialsSelect = { id: true, status: true, passwordHash: true } satisfies Prisma.UserSelect;

@injectable()
export class UserRepository implements IUserRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<UserResponseDto | null> {
    const row = await this.prisma.user.findFirst({ where: { id, deletedAt: null }, select: publicUserSelect });
    return row && toDto(row);
  }

  async findAuthUser(id: string): Promise<AuthUserRecord | null> {
    const row = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        status: true,
        role: { select: { id: true, key: true, permissions: true } },
        branches: { where: { branch: { deletedAt: null, isActive: true } }, select: { branchId: true } },
      },
    });
    return row && { id: row.id, status: row.status, role: row.role, branchIds: row.branches.map((b) => b.branchId) };
  }

  findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    return this.prisma.user.findFirst({ where: { email, deletedAt: null }, select: credentialsSelect });
  }

  findCredentialsById(id: string): Promise<UserCredentials | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null }, select: credentialsSelect });
  }

  async existsByEmail(email: string): Promise<boolean> {
    return (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) !== null;
  }

  countActiveOwners(excludeUserId?: string): Promise<number> {
    return this.prisma.user.count({
      where: {
        deletedAt: null,
        status: "ACTIVE",
        role: { key: "OWNER" },
        ...(excludeUserId && { id: { not: excludeUserId } }),
      },
    });
  }

  async create({ branchIds, ...data }: CreateUserData): Promise<UserResponseDto> {
    const row = await this.prisma.user.create({
      data: { ...data, branches: { create: branchIds.map((branchId) => ({ branchId })) } },
      select: publicUserSelect,
    });
    return toDto(row);
  }

  async update(id: string, { branchIds, ...data }: UpdateUserData): Promise<UserResponseDto | null> {
    const updated = await this.prisma.$transaction(async (tx) => {
      // updateMany so the deletedAt filter applies.
      const { count } = await tx.user.updateMany({ where: { id, deletedAt: null }, data });
      if (count === 0) return false;
      if (branchIds) {
        await tx.userBranch.deleteMany({ where: { userId: id } });
        await tx.userBranch.createMany({ data: branchIds.map((branchId) => ({ userId: id, branchId })) });
      }
      return true;
    });
    return updated ? this.findById(id) : null;
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<boolean> {
    const { count } = await this.prisma.user.updateMany({ where: { id, deletedAt: null }, data: { passwordHash } });
    return count > 0;
  }

  async touchLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  }

  async softDelete(id: string): Promise<boolean> {
    const { count } = await this.prisma.user.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date(), status: "INACTIVE" },
    });
    return count > 0;
  }

  async list({ page, limit, roleId, branchId, status, search }: ListUsersQuery): Promise<Paginated<UserResponseDto>> {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      roleId,
      status,
      ...(branchId && { branches: { some: { branchId } } }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
        ],
      }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: publicUserSelect,
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: rows.map(toDto), page, limit, total };
  }
}
