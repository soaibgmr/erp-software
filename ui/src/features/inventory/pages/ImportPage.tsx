import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { csvToObjects, formatQty, ITEM_IMPORT_COLUMNS, MAX_IMPORT_ROWS, toCsv } from "@erp-software/shared";
import { useAuth } from "@/app/auth";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, KpiCard } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Controls";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Checkbox } from "@/components/ui/Field";
import { EmptyState, ErrorBanner } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { ImportReport, ImportRowReport } from "@/lib/types";
import { errorMessage } from "@/lib/utils";
import { useStockImport } from "../api";

const EXAMPLE_ROW: Record<(typeof ITEM_IMPORT_COLUMNS)[number], string> = {
  sku: "OF-BSH-2341",
  name: "Oil filter - Swift",
  brand: "Bosch",
  category: "Filters",
  oemPartNo: "16510M68K00",
  barcode: "8901234567890",
  hsnCode: "8421",
  gstRate: "18",
  unit: "PCS",
  mrp: "450",
  salePrice: "295",
  purchasePrice: "180",
  taxInclusive: "no",
  openingQty: "12",
  minLevel: "4",
  reorderQty: "20",
  binLocation: "A-12",
};

const actionBadge: Record<ImportRowReport["action"], { tone: Tone; label: string }> = {
  create: { tone: "success", label: "New" },
  update: { tone: "info", label: "Update" },
  skip: { tone: "neutral", label: "Skip" },
  error: { tone: "danger", label: "Error" },
};

function downloadTemplate() {
  const csv = toCsv([[...ITEM_IMPORT_COLUMNS], ITEM_IMPORT_COLUMNS.map((c) => EXAMPLE_ROW[c])]);
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "item-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { branch } = useAuth();
  const importer = useStockImport();
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [requestError, setRequestError] = useState<unknown>(null);

  const preview = async (data: Record<string, string>[], update: boolean) => {
    setRequestError(null);
    try {
      setReport(await importer.mutateAsync({ rows: data, commit: false, updateExisting: update }));
    } catch (err) {
      setReport(null);
      setRequestError(err);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setReport(null);
    setRows(null);
    setFileError(null);
    const { rows: parsed } = csvToObjects(await file.text());
    if (!parsed.length) return setFileError("The file has no rows under the header line.");
    if (parsed.length > MAX_IMPORT_ROWS)
      return setFileError(`The file has ${parsed.length} rows. Split it into files of at most ${MAX_IMPORT_ROWS}.`);
    setRows(parsed);
    await preview(parsed, updateExisting);
  };

  const commit = async () => {
    if (!rows) return;
    try {
      const result = await importer.mutateAsync({ rows, commit: true, updateExisting });
      setReport(result);
      toast({ message: `Imported ${result.createCount + result.updateCount} items` });
    } catch (err) {
      toast({ message: errorMessage(err), tone: "error" });
    }
  };

  const reset = () => {
    setRows(null);
    setReport(null);
    setFileName(null);
    setFileError(null);
    setRequestError(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const visibleRows = useMemo(
    () => (problemsOnly ? report?.rows.filter((r) => r.errors.length || r.warnings.length) : report?.rows),
    [report, problemsOnly],
  );

  const columns: Column<ImportRowReport>[] = [
    { key: "row", header: "Row", align: "right", cell: (r) => <span className="text-slate">{r.row}</span> },
    {
      key: "item",
      header: "Item",
      cell: (r) => (
        <div className="min-w-0">
          <p className="font-medium text-ink">{r.name || "—"}</p>
          <p className="font-mono text-helper text-slate">{r.sku || "—"}</p>
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      cell: (r) => <Badge tone={actionBadge[r.action].tone}>{actionBadge[r.action].label}</Badge>,
    },
    {
      key: "opening",
      header: "Opening qty",
      align: "right",
      cell: (r) => (r.openingQty ? formatQty(r.openingQty) : <span className="text-muted">—</span>),
    },
    {
      key: "notes",
      header: "Problems",
      cell: (r) =>
        r.errors.length || r.warnings.length ? (
          <ul className="space-y-0.5 text-helper">
            {r.errors.map((e) => (
              <li key={e} className="text-danger">
                {e}
              </li>
            ))}
            {r.warnings.map((w) => (
              <li key={w} className="text-warning">
                {w}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
  ];

  const header = (
    <PageHeader
      breadcrumb={
        <>
          <Link to="/inventory" className="hover:text-navy-700">
            Inventory
          </Link>{" "}
          / Import
        </>
      }
      title="Import items and opening stock"
      description={`Opening quantities go into ${branch?.name ?? "the current branch"}.`}
      actions={
        <Button variant="outline" icon={<Download className="size-4" />} onClick={downloadTemplate}>
          Download template
        </Button>
      }
    />
  );

  if (report?.committed) {
    return (
      <>
        {header}
        <Card>
          <EmptyState
            icon={CheckCircle2}
            title="Import complete"
            description={`${report.createCount} new and ${report.updateCount} updated items; opening stock posted for ${report.openingStockCount}.${
              report.skipCount ? ` ${report.skipCount} existing items were left unchanged.` : ""
            }`}
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Button variant="outline" onClick={reset}>
                  Import another file
                </Button>
                <Button onClick={() => navigate("/inventory")}>View stock</Button>
              </div>
            }
          />
        </Card>
      </>
    );
  }

  const importable = report ? report.createCount + report.updateCount : 0;

  return (
    <>
      {header}
      <div className="space-y-6">
        <Card>
          <CardHeader
            title="1. Choose a CSV file"
            subtitle="Required columns: sku, name, salePrice. Save Excel sheets as CSV (UTF-8)."
          />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                id="import-file"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
              <Button
                icon={<Upload className="size-4" />}
                onClick={() => fileInput.current?.click()}
                loading={importer.isPending && !report}
                loadingText="Checking…"
              >
                {fileName ? "Choose another file" : "Choose file"}
              </Button>
              {fileName && (
                <span className="inline-flex items-center gap-2 text-body text-ink">
                  <FileSpreadsheet className="size-4 text-slate" />
                  {fileName}
                  {rows && <span className="text-slate">· {rows.length} rows</span>}
                </span>
              )}
            </div>
            <Checkbox
              label="Update existing items with the same SKU"
              description="Otherwise rows for SKUs that already exist are skipped. Opening stock is only added for items with no stock history in this branch."
              checked={updateExisting}
              onChange={(e) => {
                setUpdateExisting(e.target.checked);
                if (rows) void preview(rows, e.target.checked);
              }}
            />
            {fileError && <ErrorBanner title="Can't use this file" message={fileError} />}
            {requestError !== null && (
              <ErrorBanner
                title="Couldn't check the file"
                message={errorMessage(requestError)}
                onRetry={rows ? () => void preview(rows, updateExisting) : undefined}
              />
            )}
          </CardBody>
        </Card>

        {report && (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              <KpiCard label="Rows" value={report.total} />
              <KpiCard label="New items" value={report.createCount} />
              <KpiCard label="Updates" value={report.updateCount} />
              <KpiCard label="Skipped" value={report.skipCount} />
              <KpiCard
                label="Errors"
                value={report.errorCount}
                badge={report.errorCount > 0 && <Badge tone="danger">Fix</Badge>}
              />
              <KpiCard label="Opening stock" value={report.openingStockCount} sub="rows" />
            </div>

            {(report.newBrands.length > 0 || report.newCategories.length > 0 || report.unknownColumns.length > 0) && (
              <Card>
                <CardBody className="space-y-2 text-body">
                  {report.newBrands.length > 0 && (
                    <p>
                      <span className="font-medium text-ink">New brands:</span>{" "}
                      <span className="text-slate">{report.newBrands.join(", ")}</span>
                    </p>
                  )}
                  {report.newCategories.length > 0 && (
                    <p>
                      <span className="font-medium text-ink">New categories:</span>{" "}
                      <span className="text-slate">{report.newCategories.join(", ")}</span>
                    </p>
                  )}
                  {report.unknownColumns.length > 0 && (
                    <p>
                      <span className="font-medium text-warning">Ignored columns:</span>{" "}
                      <span className="text-slate">{report.unknownColumns.join(", ")}</span>
                    </p>
                  )}
                </CardBody>
              </Card>
            )}

            <Card>
              <CardHeader
                title="2. Check the rows"
                subtitle={
                  report.errorCount
                    ? `Fix the ${report.errorCount} rows with errors in your file, then choose it again.`
                    : "Everything looks right."
                }
                actions={
                  <Checkbox
                    label="Only rows with problems"
                    checked={problemsOnly}
                    onChange={(e) => setProblemsOnly(e.target.checked)}
                  />
                }
              />
              <DataTable
                columns={columns}
                rows={visibleRows}
                rowKey={(r) => String(r.row)}
                empty={<p className="px-6 py-10 text-center text-body text-slate">No rows with problems.</p>}
              />
            </Card>

            <div className="flex justify-end gap-3 border-t border-border pt-5">
              <Button variant="ghost" onClick={reset}>
                Start over
              </Button>
              <Button
                onClick={commit}
                disabled={report.errorCount > 0 || importable === 0}
                loading={importer.isPending}
                loadingText="Importing…"
              >
                {importable ? `Import ${importable} item${importable === 1 ? "" : "s"}` : "Nothing to import"}
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
