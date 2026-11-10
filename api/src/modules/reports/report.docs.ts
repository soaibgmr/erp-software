import { REPORT_NAMES, reportQuerySchema, tallyExportQuerySchema } from "@automobile/shared";
import { operation, pathParam, type Paths, queryParams, ref, success } from "../../docs/openapi.helpers";

const cell = { type: ["string", "number", "null"] };

export const reportSchemas = {
  ReportTable: {
    type: "object",
    required: ["key", "columns", "rows"],
    properties: {
      key: { type: "string" },
      title: { type: "string" },
      columns: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: { type: "string" },
            label: { type: "string" },
            type: { type: "string", enum: ["text", "date", "datetime", "money", "qty", "int", "percent"] },
          },
        },
      },
      rows: { type: "array", items: { type: "object", additionalProperties: cell } },
      totals: { type: "object", additionalProperties: cell },
    },
  },
  ReportResult: {
    type: "object",
    properties: {
      name: { type: "string", enum: [...REPORT_NAMES] },
      title: { type: "string" },
      from: { type: ["string", "null"], format: "date" },
      to: { type: ["string", "null"], format: "date" },
      asOf: { type: "string", format: "date" },
      scope: {
        type: "object",
        properties: { branchIds: { type: "array", items: { type: "string" } }, label: { type: "string" } },
      },
      tables: { type: "array", items: ref("ReportTable") },
      notes: { type: "array", items: { type: "string" } },
    },
  },
};

const file = (description: string, type: string) => ({
  description,
  content: { [type]: { schema: { type: "string", format: "binary" } } },
});

export const reportPaths: Paths = {
  "/api/v1/reports": {
    get: operation({
      tag: "Reports",
      summary: "Report catalog",
      responses: { 200: success("Report definitions", { type: "array", items: { type: "object" } }) },
    }),
  },
  "/api/v1/reports/{name}": {
    get: operation({
      tag: "Reports",
      summary: "Run a report",
      description:
        "`from`/`to` are inclusive days in the app timezone (default: this month so far, at most 366 days). " +
        "`branchId` defaults to the `x-branch-id` header; `all` = every branch you can access. " +
        "`format=csv|xlsx` downloads a file; `format=portal` (GSTR-1 only) downloads the GST offline tool JSON. " +
        "`groupBy` and `customerId` apply to the sales register. Cancelled invoices and bills appear with zero amounts.",
      parameters: [pathParam("name", { type: "string", enum: [...REPORT_NAMES] }), ...queryParams(reportQuerySchema)],
      responses: {
        200: {
          ...success("Report tables", ref("ReportResult")),
          content: {
            ...success("Report tables", ref("ReportResult")).content,
            "text/csv": { schema: { type: "string" } },
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
              schema: { type: "string", format: "binary" },
            },
          },
        },
      },
    }),
  },
  "/api/v1/reports/tally-export": {
    get: operation({
      tag: "Reports",
      summary: "Tally vouchers XML",
      description:
        "Sales and credit notes, and customer receipts/refunds as Tally import XML. " +
        "Ledgers used: party names, `Sales @ n%`, `Output CGST|SGST|IGST`, `Cash`, `Bank`, `Cash Sales`, `Round Off`.",
      parameters: queryParams(tallyExportQuerySchema),
      responses: { 200: file("Tally XML", "application/xml") },
    }),
  },
};
