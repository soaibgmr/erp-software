import type { Paginated } from "../../../common/pagination";
import type {
  AuthUserRecord,
  CreateUserData,
  ListUsersQuery,
  UpdateUserData,
  UserCredentials,
  UserResponseDto,
} from "../user.types";

export interface IUserRepository {
  findById(id: string): Promise<UserResponseDto | null>;
  findAuthUser(id: string): Promise<AuthUserRecord | null>;
  findCredentialsByEmail(email: string): Promise<UserCredentials | null>;
  findCredentialsById(id: string): Promise<UserCredentials | null>;
  // Includes soft-deleted rows: the unique index on email covers them too.
  existsByEmail(email: string): Promise<boolean>;
  // Active, non-deleted users holding the OWNER role, optionally ignoring one user.
  countActiveOwners(excludeUserId?: string): Promise<number>;
  create(data: CreateUserData): Promise<UserResponseDto>;
  update(id: string, data: UpdateUserData): Promise<UserResponseDto | null>;
  updatePasswordHash(id: string, passwordHash: string): Promise<boolean>;
  touchLastLogin(id: string): Promise<void>;
  softDelete(id: string): Promise<boolean>;
  list(query: ListUsersQuery): Promise<Paginated<UserResponseDto>>;
}
