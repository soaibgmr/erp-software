import type { BranchListFilter, BranchResponseDto, CreateBranchDto, UpdateBranchDto } from "../branch.types";

export interface IBranchRepository {
  findById(id: string): Promise<BranchResponseDto | null>;
  // Includes soft-deleted rows: the unique index on code covers them too.
  existsByCode(code: string, excludeId?: string): Promise<boolean>;
  findManyByIds(ids: string[]): Promise<BranchResponseDto[]>;
  list(filter: BranchListFilter): Promise<BranchResponseDto[]>;
  countActive(): Promise<number>;
  create(data: CreateBranchDto): Promise<BranchResponseDto>;
  update(id: string, data: UpdateBranchDto): Promise<BranchResponseDto | null>;
  softDelete(id: string): Promise<boolean>;
}
