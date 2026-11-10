import type { CreateRoleDto, RoleResponseDto, UpdateRoleDto } from "../role.types";

export interface IRoleRepository {
  findById(id: string): Promise<RoleResponseDto | null>;
  findByKey(key: string): Promise<RoleResponseDto | null>;
  // Includes soft-deleted rows: the unique index on name covers them too.
  existsByName(name: string, excludeId?: string): Promise<boolean>;
  list(): Promise<RoleResponseDto[]>;
  create(data: CreateRoleDto): Promise<RoleResponseDto>;
  update(id: string, data: UpdateRoleDto): Promise<RoleResponseDto | null>;
  softDelete(id: string): Promise<boolean>;
}
