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
  UserContact,
  UserCredentials,
  UserResponseDto,
} from "./user.types";

type Db = PrismaClient | Prisma.TransactionClient;

// Whitelist of columns safe to return; keeps passwordHash out of every query by default.
const publicUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  mobile: true,
  email: true,
  emailVerifiedAt: true,
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

const credentialsSelect = {
  id: true,
  status: true,
  passwordHash: true,
  businessId: true,
  business: { select: { status: true } },
} satisfies Prisma.UserSelect;

type CredentialsRow = Prisma.UserGetPayload<{ select: typeof credentialsSelect }>;
const toCredentials = (row: CredentialsRow | null): UserCredentials | null =>
  row && {
    id: row.id,
    status: row.status,
    passwordHash: row.passwordHash,
    businessId: row.businessId,
    businessStatus: row.business.status,
  };

const contactSelect = { id: true, firstName: true, email: true, businessId: true } satisfies Prisma.UserSelect;

// Mobile numbers never contain "@", so one box can carry either.
const identifierWhere = (identifier: string): Prisma.UserWhereInput =>
  identifier.includes("@") ? { email: identifier } : { mobile: identifier };

@injectable()
export class UserRepository implements IUserRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  async findById(businessId: string, id: string): Promise<UserResponseDto | null> {
    const row = await this.prisma.user.findFirst({
      where: { id, businessId, deletedAt: null },
      select: publicUserSelect,
    });
    return row && toDto(row);
  }

  async findAuthUser(id: string): Promise<AuthUserRecord | null> {
    const row = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        status: true,
        businessId: true,
        business: { select: { status: true } },
        role: { select: { id: true, key: true, permissions: true } },
        branches: { where: { branch: { deletedAt: null, isActive: true } }, select: { branchId: true } },
      },
    });
    if (!row) return null;
    // Owners work in every branch of their own business.
    const branchIds =
      row.role.key === "OWNER"
        ? (
            await this.prisma.branch.findMany({
              where: { businessId: row.businessId, deletedAt: null },
              select: { id: true },
            })
          ).map((b) => b.id)
        : row.branches.map((b) => b.branchId);
    return {
      id: row.id,
      status: row.status,
      businessId: row.businessId,
      businessStatus: row.business.status,
      role: row.role,
      branchIds,
    };
  }

  async findCredentialsByIdentifier(identifier: string): Promise<UserCredentials | null> {
    const row = await this.prisma.user.findFirst({
      where: { ...identifierWhere(identifier), deletedAt: null },
      select: credentialsSelect,
    });
    return toCredentials(row);
  }

  async findCredentialsById(id: string): Promise<UserCredentials | null> {
    const row = await this.prisma.user.findFirst({ where: { id, deletedAt: null }, select: credentialsSelect });
    return toCredentials(row);
  }

  findContactByIdentifier(identifier: string): Promise<UserContact | null> {
    return this.prisma.user.findFirst({
      where: { ...identifierWhere(identifier), deletedAt: null, status: "ACTIVE" },
      select: contactSelect,
    });
  }

  findContactById(id: string): Promise<UserContact | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null }, select: contactSelect });
  }

  async existsByEmail(email: string, excludeId?: string): Promise<boolean> {
    const found = await this.prisma.user.findFirst({
      where: { email, ...(excludeId && { id: { not: excludeId } }) },
      select: { id: true },
    });
    return found !== null;
  }

  async existsByMobile(mobile: string, excludeId?: string): Promise<boolean> {
    const found = await this.prisma.user.findFirst({
      where: { mobile, ...(excludeId && { id: { not: excludeId } }) },
      select: { id: true },
    });
    return found !== null;
  }

  countActiveOwners(businessId: string, excludeUserId?: string): Promise<number> {
    return this.prisma.user.count({
      where: {
        businessId,
        deletedAt: null,
        status: "ACTIVE",
        role: { key: "OWNER" },
        ...(excludeUserId && { id: { not: excludeUserId } }),
      },
    });
  }

  async create(
    businessId: string,
    { branchIds, ...data }: CreateUserData,
    db: Db = this.prisma,
  ): Promise<UserResponseDto> {
    const row = await db.user.create({
      data: { ...data, businessId, branches: { create: branchIds.map((branchId) => ({ branchId })) } },
      select: publicUserSelect,
    });
    return toDto(row);
  }

  async update(
    businessId: string,
    id: string,
    { branchIds, ...data }: UpdateUserData,
  ): Promise<UserResponseDto | null> {
    const updated = await this.prisma.$transaction(async (tx) => {
      // updateMany so the businessId and deletedAt filters apply.
      const { count } = await tx.user.updateMany({ where: { id, businessId, deletedAt: null }, data });
      if (count === 0) return false;
      if (branchIds) {
        await tx.userBranch.deleteMany({ where: { userId: id } });
        await tx.userBranch.createMany({ data: branchIds.map((branchId) => ({ userId: id, branchId })) });
      }
      return true;
    });
    return updated ? this.findById(businessId, id) : null;
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<boolean> {
    const { count } = await this.prisma.user.updateMany({ where: { id, deletedAt: null }, data: { passwordHash } });
    return count > 0;
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.prisma.user.updateMany({ where: { id, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
  }

  async touchLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  }

  async softDelete(businessId: string, id: string): Promise<boolean> {
    const { count } = await this.prisma.user.updateMany({
      where: { id, businessId, deletedAt: null },
      data: { deletedAt: new Date(), status: "INACTIVE" },
    });
    return count > 0;
  }

  async list(
    businessId: string,
    { page, limit, roleId, branchId, status, search }: ListUsersQuery,
  ): Promise<Paginated<UserResponseDto>> {
    const where: Prisma.UserWhereInput = {
      businessId,
      deletedAt: null,
      roleId,
      status,
      ...(branchId && { branches: { some: { branchId } } }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { mobile: { contains: search } },
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
