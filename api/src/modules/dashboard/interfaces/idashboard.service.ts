import type { AuthContext } from "../../../common/auth-context";
import type {
  DashboardSummaryDto,
  DashboardSummaryQuery,
  LowStockDto,
  LowStockQuery,
  SalesTrendDto,
  SalesTrendQuery,
} from "../dashboard.types";

export interface IDashboardService {
  summary(
    auth: AuthContext,
    currentBranchId: string | undefined,
    query: DashboardSummaryQuery,
  ): Promise<DashboardSummaryDto>;
  salesTrend(auth: AuthContext, currentBranchId: string | undefined, query: SalesTrendQuery): Promise<SalesTrendDto>;
  lowStock(auth: AuthContext, currentBranchId: string | undefined, query: LowStockQuery): Promise<LowStockDto>;
}
