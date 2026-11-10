import type { Prisma, PrismaClient } from "@prisma/client";
import type { BranchListFilter, BranchResponseDto, CreateBranchDto, UpdateBranchDto } from "../branch.types";

// Every method is limited to one business (company).
export interface IBranchRepository {
  findById(businessId: string, id: string): Promise<BranchResponseDto | null>;
  // Includes soft-deleted rows: the unique index on (business, code) covers them too.
  existsByCode(businessId: string, code: string, excludeId?: string): Promise<boolean>;
  findManyByIds(businessId: string, ids: string[]): Promise<BranchResponseDto[]>;
  list(businessId: string, filter: BranchListFilter): Promise<BranchResponseDto[]>;
  countActive(businessId: string): Promise<number>;
  create(
    businessId: string,
    data: CreateBranchDto,
    db?: PrismaClient | Prisma.TransactionClient,
  ): Promise<BranchResponseDto>;
  update(businessId: string, id: string, data: UpdateBranchDto): Promise<BranchResponseDto | null>;
  softDelete(businessId: string, id: string): Promise<boolean>;
}
