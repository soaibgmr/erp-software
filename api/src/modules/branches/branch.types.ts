import type { BranchCreate, BranchUpdate } from "@automobile/shared";

export type CreateBranchDto = BranchCreate;
export type UpdateBranchDto = BranchUpdate;

export interface BranchResponseDto {
  id: string;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  pincode: string | null;
  stateCode: string;
  gstin: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListBranchesQuery {
  includeInactive: boolean;
  search?: string;
}

export interface BranchListFilter extends ListBranchesQuery {
  // undefined = every branch (owners); otherwise only these ids.
  ids?: string[];
}
