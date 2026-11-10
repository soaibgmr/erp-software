import type { AuthContext } from "../../../common/auth-context";
import type { Paginated } from "../../../common/pagination";
import type { CloseShiftDto, ListShiftsQuery, OpenShiftDto, ShiftDto, ShiftReportDto } from "../shift.types";

export interface IShiftService {
  // The user's open shift in the branch with running totals, or null.
  current(auth: AuthContext, branchId: string): Promise<ShiftReportDto | null>;
  // For posting: the id of the user's open shift, or null.
  findOpenId(branchId: string, userId: string): Promise<string | null>;
  open(auth: AuthContext, branchId: string, input: OpenShiftDto): Promise<ShiftReportDto>;
  // Stores counted vs expected per payment method; the variance is audited.
  close(auth: AuthContext, branchId: string, id: string, input: CloseShiftDto): Promise<ShiftReportDto>;
  report(auth: AuthContext, id: string): Promise<ShiftReportDto>;
  list(auth: AuthContext, branchId: string, query: ListShiftsQuery): Promise<Paginated<ShiftDto>>;
}
