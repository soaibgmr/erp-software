import type { CreateRoleDto, RoleResponseDto, UpdateRoleDto } from "../role.types";

// Roles belong to one business; every method is limited to it.
export interface IRoleRepository {
  findById(businessId: string, id: string): Promise<RoleResponseDto | null>;
  findByKey(businessId: string, key: string): Promise<RoleResponseDto | null>;
  // Includes soft-deleted rows: the unique index on (business, name) covers them too.
  existsByName(businessId: string, name: string, excludeId?: string): Promise<boolean>;
  list(businessId: string): Promise<RoleResponseDto[]>;
  create(businessId: string, data: CreateRoleDto): Promise<RoleResponseDto>;
  update(businessId: string, id: string, data: UpdateRoleDto): Promise<RoleResponseDto | null>;
  softDelete(businessId: string, id: string): Promise<boolean>;
}
