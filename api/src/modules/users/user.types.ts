import type { UserStatus } from "@prisma/client";
import type { Permission, UserCreate, UserUpdate } from "@erp-software/shared";

export type { UserStatus };

export interface RoleSummary {
  id: string;
  key: string | null;
  name: string;
}

export interface BranchSummary {
  id: string;
  code: string;
  name: string;
}

// Shape returned to clients: never includes passwordHash or deletedAt.
export interface UserResponseDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  lastLoginAt: Date | null;
  role: RoleSummary;
  branches: BranchSummary[];
  createdAt: Date;
  updatedAt: Date;
}

// GET /users/me: the profile plus what the UI needs to build menus and the branch switcher.
export interface MeResponseDto {
  user: UserResponseDto;
  isOwner: boolean;
  permissions: Permission[];
  // Branches the user can switch to (every active branch for owners).
  branches: (BranchSummary & { stateCode: string; city: string | null })[];
}

// What AuthMiddleware needs on every request.
export interface AuthUserRecord {
  id: string;
  status: UserStatus;
  role: { id: string; key: string | null; permissions: string[] };
  branchIds: string[];
}

export interface UserCredentials {
  id: string;
  status: UserStatus;
  passwordHash: string;
}

export interface TokenPair {
  token: string;
  refreshToken: string;
}

export interface AuthResponseDto extends TokenPair {
  user: UserResponseDto;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateProfileDto {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
}

export type CreateUserDto = UserCreate;
export type UpdateUserDto = UserUpdate;

export interface ListUsersQuery {
  page: number;
  limit: number;
  roleId?: string;
  branchId?: string;
  status?: UserStatus;
  search?: string;
}

// Repository-level inputs (password already hashed).
export interface CreateUserData extends Omit<CreateUserDto, "password"> {
  passwordHash: string;
}

export type UpdateUserData = UpdateUserDto;

export interface CreateRefreshTokenData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}
