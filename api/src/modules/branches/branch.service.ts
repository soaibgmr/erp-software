import { inject, injectable } from "inversify";
import { TYPES } from "../../config/ioc.types";
import { canAccessBranch, type AuthContext } from "../../common/auth-context";
import { badRequest, conflict, fieldErrors, forbidden, notFound } from "../../common/http-error";
import type { IAuditService } from "../audit/interfaces/iaudit.service";
import type { IBranchRepository } from "./interfaces/ibranch.repository";
import type { IBranchService } from "./interfaces/ibranch.service";
import type { BranchResponseDto, CreateBranchDto, ListBranchesQuery, UpdateBranchDto } from "./branch.types";

@injectable()
export class BranchService implements IBranchService {
  constructor(
    @inject(TYPES.BranchRepository) private readonly branches: IBranchRepository,
    @inject(TYPES.AuditService) private readonly audit: IAuditService,
  ) {}

  // Owners see every branch of their business; everyone else only the branches they're assigned to.
  list(auth: AuthContext, query: ListBranchesQuery): Promise<BranchResponseDto[]> {
    return this.branches.list(auth.businessId, { ...query, ids: auth.isOwner ? undefined : auth.branchIds });
  }

  async getById(auth: AuthContext, id: string): Promise<BranchResponseDto> {
    if (!canAccessBranch(auth, id)) throw forbidden("You don't have access to this branch");
    const branch = await this.branches.findById(auth.businessId, id);
    if (!branch) throw notFound("Branch not found");
    return branch;
  }

  async create(auth: AuthContext, input: CreateBranchDto): Promise<BranchResponseDto> {
    if (await this.branches.existsByCode(auth.businessId, input.code))
      throw conflict(`Branch code ${input.code} is already used`);
    const branch = await this.branches.create(auth.businessId, input);
    await this.audit.record(auth, { action: "branch.create", entity: "Branch", entityId: branch.id, after: branch });
    return branch;
  }

  async update(auth: AuthContext, id: string, input: UpdateBranchDto): Promise<BranchResponseDto> {
    const before = await this.branches.findById(auth.businessId, id);
    if (!before) throw notFound("Branch not found");

    if (input.code && (await this.branches.existsByCode(auth.businessId, input.code, id))) {
      throw conflict(`Branch code ${input.code} is already used`);
    }
    const gstin = input.gstin === undefined ? before.gstin : input.gstin;
    const stateCode = input.stateCode ?? before.stateCode;
    if (gstin && gstin.slice(0, 2) !== stateCode) {
      throw fieldErrors([{ path: "stateCode", message: "State must match the GSTIN state code" }]);
    }
    if (input.isActive === false && before.isActive && (await this.branches.countActive(auth.businessId)) <= 1) {
      throw badRequest("At least one branch must stay active");
    }

    const branch = await this.branches.update(auth.businessId, id, input);
    if (!branch) throw notFound("Branch not found");
    await this.audit.record(auth, { action: "branch.update", entity: "Branch", entityId: id, before, after: branch });
    return branch;
  }

  async remove(auth: AuthContext, id: string): Promise<void> {
    const before = await this.branches.findById(auth.businessId, id);
    if (!before) throw notFound("Branch not found");
    if (before.isActive && (await this.branches.countActive(auth.businessId)) <= 1) {
      throw badRequest("You cannot delete the only active branch");
    }
    await this.branches.softDelete(auth.businessId, id);
    await this.audit.record(auth, { action: "branch.delete", entity: "Branch", entityId: id, before });
  }
}
