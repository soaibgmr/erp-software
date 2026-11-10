import type { Prisma, PrismaClient } from "@prisma/client";
import type { Paginated } from "../../../common/pagination";
import type {
  AuthUserRecord,
  CreateUserData,
  ListUsersQuery,
  UpdateUserData,
  UserContact,
  UserCredentials,
  UserResponseDto,
} from "../user.types";

// Methods taking a businessId only see that company's users. Lookups by id or identifier without one
// serve sign-in flows, where the company is not known yet.
export interface IUserRepository {
  findById(businessId: string, id: string): Promise<UserResponseDto | null>;
  findAuthUser(id: string): Promise<AuthUserRecord | null>;
  // Mobile number, or email when it contains "@".
  findCredentialsByIdentifier(identifier: string): Promise<UserCredentials | null>;
  findCredentialsById(id: string): Promise<UserCredentials | null>;
  findContactByIdentifier(identifier: string): Promise<UserContact | null>;
  findContactById(id: string): Promise<UserContact | null>;
  // Mobile and email are unique across every company. Both include soft-deleted rows (the unique index covers them).
  existsByEmail(email: string, excludeId?: string): Promise<boolean>;
  existsByMobile(mobile: string, excludeId?: string): Promise<boolean>;
  // Active, non-deleted users holding the OWNER role, optionally ignoring one user.
  countActiveOwners(businessId: string, excludeUserId?: string): Promise<number>;
  create(
    businessId: string,
    data: CreateUserData,
    db?: PrismaClient | Prisma.TransactionClient,
  ): Promise<UserResponseDto>;
  update(businessId: string, id: string, data: UpdateUserData): Promise<UserResponseDto | null>;
  updatePasswordHash(id: string, passwordHash: string): Promise<boolean>;
  markEmailVerified(id: string): Promise<void>;
  touchLastLogin(id: string): Promise<void>;
  softDelete(businessId: string, id: string): Promise<boolean>;
  list(businessId: string, query: ListUsersQuery): Promise<Paginated<UserResponseDto>>;
}
