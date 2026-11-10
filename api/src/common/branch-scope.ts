import type { IBranchRepository } from "../modules/branches/interfaces/ibranch.repository";
import { canAccessBranch, type AuthContext } from "./auth-context";
import { badRequest, forbidden } from "./http-error";

export interface BranchScope {
  branchIds: string[];
  // "Main branch" or "All branches"; printed on reports and exports.
  label: string;
  branches: { id: string; code: string; name: string; stateCode: string; gstin: string | null }[];
}

// Resolves `?branchId=` for dashboards and reports: a branch id, "all" (every active branch the
// user can access) or nothing (the x-branch-id header).
export async function resolveBranchScope(
  branches: IBranchRepository,
  auth: AuthContext,
  requested: string | undefined,
  currentBranchId: string | undefined,
): Promise<BranchScope> {
  if (requested === "all") {
    const list = await branches.list({ includeInactive: false, ids: auth.isOwner ? undefined : auth.branchIds });
    return {
      branchIds: list.map((b) => b.id),
      label: "All branches",
      branches: list.map(pick),
    };
  }
  const id = requested ?? currentBranchId;
  if (!id) throw badRequest("Choose a branch");
  if (!canAccessBranch(auth, id)) throw forbidden("You don't have access to this branch");
  const branch = await branches.findById(id);
  if (!branch) throw badRequest("Branch not found");
  return { branchIds: [id], label: branch.name, branches: [pick(branch)] };
}

const pick = (b: { id: string; code: string; name: string; stateCode: string; gstin: string | null }) => ({
  id: b.id,
  code: b.code,
  name: b.name,
  stateCode: b.stateCode,
  gstin: b.gstin,
});
