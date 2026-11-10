import { inject, injectable } from "inversify";
import type { Request, Response } from "express";
import { REPORTS } from "@erp-software/shared";
import { TYPES } from "../../config/ioc.types";
import { sendSuccess } from "../../common/api-response";
import { badRequest } from "../../common/http-error";
import type { IReportService } from "./interfaces/ireport.service";
import { reportFileName, reportToCsv, reportToXlsx } from "./report.export";

// Sends a file download. Files are the one exception to the JSON envelope; errors still use it.
function sendFile(res: Response, fileName: string, contentType: string, body: string | Buffer) {
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
  res.status(200).send(body);
}

@injectable()
export class ReportController {
  constructor(@inject(TYPES.ReportService) private readonly reports: IReportService) {}

  catalog = async (_req: Request, res: Response) => {
    sendSuccess(res, REPORTS);
  };

  run = async (_req: Request, res: Response) => {
    const { name } = res.locals.params;
    const query = res.locals.query;
    const auth = res.locals.auth;
    const branchId = res.locals.branchId;

    if (query.format === "portal") {
      if (name !== "gstr1") throw badRequest("format=portal is only for GSTR-1");
      const { fileName, json } = await this.reports.gstr1Json(auth, branchId, query);
      return sendFile(res, fileName, "application/json; charset=utf-8", JSON.stringify(json, null, 2));
    }
    const result = await this.reports.run(auth, branchId, name, query);
    if (query.format === "csv")
      return sendFile(res, reportFileName(result, "csv"), "text/csv; charset=utf-8", reportToCsv(result));
    if (query.format === "xlsx")
      return sendFile(
        res,
        reportFileName(result, "xlsx"),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        reportToXlsx(result),
      );
    sendSuccess(res, result);
  };

  tally = async (_req: Request, res: Response) => {
    const { fileName, xml, count } = await this.reports.tallyExport(
      res.locals.auth,
      res.locals.branchId,
      res.locals.query,
    );
    res.setHeader("X-Voucher-Count", String(count));
    sendFile(res, fileName, "application/xml; charset=utf-8", xml);
  };
}
