import { inject, injectable } from "inversify";
import type { Permission } from "@automobile/shared";
import { TYPES } from "../../config/ioc.types";
import type { AuthContext } from "../../common/auth-context";
import { badRequest, conflict, forbidden, notFound } from "../../common/http-error";
import type { IAuditService } from "../audit/interfaces/iaudit.service";
import type { IRoleRepository } from "./interfaces/irole.repository";
import type { IRoleService } from "./interfaces/irole.service";
import type { CreateRoleDto, RoleResponseDto, UpdateRoleDto } from "./role.types";

@injectable()
export class RoleService implements IRoleService {
  constructor(
    @inject(TYPES.RoleRepository) private readonly roles: IRoleRepository,
    @inject(TYPES.AuditService) private readonly audit: IAuditService,
  ) {}

  list(): Promise<RoleResponseDto[]> {
    return this.roles.list();
  }

  async getById(id: string): Promise<RoleResponseDto> {
    const role = await this.roles.findById(id);
    if (!role) throw notFound("Role not found");
    return role;
  }

  async create(auth: AuthContext, input: CreateRoleDto): Promise<RoleResponseDto> {
    this.assertCanGrant(auth, input.permissions);
    if (await this.roles.existsByName(input.name)) throw conflict(`A role named ${input.name} already exists`);

    const role = await this.roles.create({ ...input, permissions: [...new Set(input.permissions)] });
    await this.audit.record(auth, { action: "role.create", entity: "Role", entityId: role.id, after: role });
    return role;
  }

  async update(auth: AuthContext, id: string, input: UpdateRoleDto): Promise<RoleResponseDto> {
    const before = await this.getById(id);
    if (before.key === "OWNER") throw badRequest("The Owner role always has full access and can't be changed");
    if (input.permissions) this.assertCanGrant(auth, input.permissions);
    if (input.name && (await this.roles.existsByName(input.name, id))) {
      throw conflict(`A role named ${input.name} already exists`);
    }

    const role = await this.roles.update(id, {
      ...input,
      ...(input.permissions && { permissions: [...new Set(input.permissions)] }),
    });
    if (!role) throw notFound("Role not found");
    await this.audit.record(auth, { action: "role.update", entity: "Role", entityId: id, before, after: role });
    return role;
  }

  async remove(auth: AuthContext, id: string): Promise<void> {
    const before = await this.getById(id);
    if (before.isSystem) throw badRequest("System roles can't be deleted");
    if (before.userCount > 0) {
      throw conflict(`Move the ${before.userCount} user(s) with this role to another role first`);
    }
    await this.roles.softDelete(id);
    await this.audit.record(auth, { action: "role.delete", entity: "Role", entityId: id, before });
  }

  // A non-owner can't create a role with more power than their own.
  private assertCanGrant(auth: AuthContext, permissions: Permission[]) {
    if (auth.isOwner) return;
    const missing = permissions.filter((p) => !auth.permissions.includes(p));
    if (missing.length) throw forbidden(`You can't grant permissions you don't have: ${missing.join(", ")}`);
  }
}
