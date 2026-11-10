import type { AuthContext } from "../../../common/auth-context";
import type { BranchResponseDto, CreateBranchDto, ListBranchesQuery, UpdateBranchDto } from "../branch.types";

export interface IBranchService {
  list(auth: AuthContext, query: ListBranchesQuery): Promise<BranchResponseDto[]>;
  getById(auth: AuthContext, id: string): Promise<BranchResponseDto>;
  create(auth: AuthContext, input: CreateBranchDto): Promise<BranchResponseDto>;
  update(auth: AuthContext, id: string, input: UpdateBranchDto): Promise<BranchResponseDto>;
  remove(auth: AuthContext, id: string): Promise<void>;
}
