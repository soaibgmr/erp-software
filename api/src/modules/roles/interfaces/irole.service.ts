import type { AuthContext } from "../../../common/auth-context";
import type { CreateRoleDto, RoleResponseDto, UpdateRoleDto } from "../role.types";

export interface IRoleService {
  list(): Promise<RoleResponseDto[]>;
  getById(id: string): Promise<RoleResponseDto>;
  create(auth: AuthContext, input: CreateRoleDto): Promise<RoleResponseDto>;
  update(auth: AuthContext, id: string, input: UpdateRoleDto): Promise<RoleResponseDto>;
  remove(auth: AuthContext, id: string): Promise<void>;
}
