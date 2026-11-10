import type { RoleCreate, RoleUpdate } from "@automobile/shared";

export type CreateRoleDto = RoleCreate;
export type UpdateRoleDto = RoleUpdate;

export interface RoleResponseDto {
  id: string;
  key: string | null;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  userCount: number;
  createdAt: Date;
  updatedAt: Date;
}
