import type { ReportQuery, ReportResult, TallyExportQuery } from "@automobile/shared";
import type { AuthContext } from "../../../common/auth-context";
import type { Gstr1Json } from "../gstr1";

export interface IReportService {
  // Any report in REPORTS by name; 404 for an unknown name.
  run(auth: AuthContext, currentBranchId: string | undefined, name: string, query: ReportQuery): Promise<ReportResult>;
  // GSTR-1 in the GST offline tool's JSON format (one GSTIN).
  gstr1Json(
    auth: AuthContext,
    currentBranchId: string | undefined,
    query: ReportQuery,
  ): Promise<{ fileName: string; json: Gstr1Json }>;
  tallyExport(
    auth: AuthContext,
    currentBranchId: string | undefined,
    query: TallyExportQuery,
  ): Promise<{ fileName: string; xml: string; count: number }>;
}
