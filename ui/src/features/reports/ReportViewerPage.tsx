import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Download, FileJson, FileSpreadsheet, Inbox } from "lucide-react";
import { reportDefinition, SALES_GROUP_BY_LABELS, SALES_GROUP_BYS, type SalesGroupBy } from "@automobile/shared";
import { useAuth } from "@/app/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Chip, PageHeader, SegmentedControl } from "@/components/ui/Controls";
import { Field, Input, Select } from "@/components/ui/Field";
import { EmptyState, ErrorBanner, TableSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { NotFoundPage } from "@/features/home/ComingSoonPage";
import { errorMessage } from "@/lib/utils";
import { downloadReport, useReport, type BranchScopeOption, type ReportParams } from "./api";
import { monthStart, PERIOD_PRESETS, today } from "./dates";
import { formatCell, ReportTableView } from "./ReportTable";

// One page renders every report: filters live in the URL so a report link can be shared or bookmarked.
export function ReportViewerPage() {
  const { name = "" } = useParams();
  const def = reportDefinition(name);
  return def ? <Viewer key={def.name} name={def.name} /> : <NotFoundPage />;
}

function Viewer({ name }: { name: string }) {
  const def = reportDefinition(name)!;
  const { me, branch } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);

  const from = params.get("from") ?? monthStart();
  const to = params.get("to") ?? today();
  const scope: BranchScopeOption = params.get("scope") === "all" ? "all" : "branch";
  const groupBy = (SALES_GROUP_BYS as readonly string[]).includes(params.get("groupBy") ?? "")
    ? (params.get("groupBy") as SalesGroupBy)
    : "invoice";
  const isSales = name === "sales-register";

  const reportParams: ReportParams = {
    ...(def.dated && { from, to }),
    scope,
    ...(isSales && { groupBy }),
  };
  const query = useReport(name, reportParams);
  const data = query.data;

  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  const download = async (format: "csv" | "xlsx" | "portal") => {
    setBusy(format);
    try {
      const file = await downloadReport(name, reportParams, format);
      toast({ message: `${file} downloaded` });
    } catch (err) {
      toast({ message: errorMessage(err), tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  const activePreset = PERIOD_PRESETS.find((p) => {
    const [f, t] = p.range();
    return f === from && t === to;
  })?.key;

  return (
    <>
      <PageHeader
        title={data?.title ?? def.title}
        breadcrumb={
          <Link to="/reports" className="hover:underline">
            Reports
          </Link>
        }
        description={def.description}
        actions={
          <>
            {name === "gstr1" && (
              <Button
                variant="outline"
                onClick={() => download("portal")}
                loading={busy === "portal"}
                disabled={!data}
                icon={<FileJson className="size-4" />}
              >
                Portal JSON
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => download("csv")}
              loading={busy === "csv"}
              disabled={!data}
              icon={<Download className="size-4" />}
            >
              CSV
            </Button>
            <Button
              onClick={() => download("xlsx")}
              loading={busy === "xlsx"}
              disabled={!data}
              icon={<FileSpreadsheet className="size-4" />}
            >
              Excel
            </Button>
          </>
        }
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4 px-6 py-4">
          {def.dated && (
            <>
              <div className="flex flex-wrap gap-2">
                {PERIOD_PRESETS.map((p) => (
                  <Chip
                    key={p.key}
                    selected={activePreset === p.key}
                    onClick={() => {
                      const [f, t] = p.range();
                      set({ from: f, to: t });
                    }}
                  >
                    {p.label}
                  </Chip>
                ))}
              </div>
              <Field label="From" className="w-40">
                {(f) => (
                  <Input
                    {...f}
                    type="date"
                    value={from}
                    max={to}
                    onChange={(e) => e.target.value && set({ from: e.target.value })}
                  />
                )}
              </Field>
              <Field label="To" className="w-40">
                {(f) => (
                  <Input
                    {...f}
                    type="date"
                    value={to}
                    min={from}
                    onChange={(e) => e.target.value && set({ to: e.target.value })}
                  />
                )}
              </Field>
            </>
          )}
          {isSales && (
            <Field label="Group by" className="w-44">
              {(f) => (
                <Select
                  {...f}
                  value={groupBy}
                  onChange={(e) => set({ groupBy: e.target.value === "invoice" ? undefined : e.target.value })}
                >
                  {SALES_GROUP_BYS.map((g) => (
                    <option key={g} value={g}>
                      {SALES_GROUP_BY_LABELS[g]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          {(me?.branches.length ?? 0) > 1 && (
            <SegmentedControl<BranchScopeOption>
              label="Branches"
              value={scope}
              onChange={(v) => set({ scope: v === "all" ? "all" : undefined })}
              options={[
                { value: "branch", label: branch?.name ?? "This branch" },
                { value: "all", label: "All branches" },
              ]}
            />
          )}
          {!def.dated && data && (
            <p className="pb-2 text-helper text-slate">
              As of today ({formatCell({ key: "d", label: "", type: "date" }, data.asOf)})
            </p>
          )}
        </div>
      </Card>

      {query.isPending ? (
        <Card>
          <TableSkeleton rows={8} columns={6} />
        </Card>
      ) : query.error || !data ? (
        <ErrorBanner
          title="Couldn't run this report"
          message={errorMessage(query.error)}
          onRetry={() => query.refetch()}
        />
      ) : (
        <div className={query.isFetching ? "space-y-6 opacity-60 transition-opacity" : "space-y-6"}>
          {data.tables.map((t) => (
            <Card key={t.key}>
              {(t.title || data.tables.length === 1) && (
                <CardHeader
                  title={t.title ?? data.scope.label}
                  subtitle={`${t.rows.length} row${t.rows.length === 1 ? "" : "s"}${t.title ? "" : data.from ? ` · ${formatCell({ key: "d", label: "", type: "date" }, data.from)} to ${formatCell({ key: "d", label: "", type: "date" }, data.to)}` : ""}`}
                />
              )}
              {t.rows.length ? (
                <ReportTableView table={t} />
              ) : (
                <EmptyState
                  icon={Inbox}
                  title="Nothing to show"
                  description={
                    def.dated
                      ? "No entries in this period. Try a longer period or all branches."
                      : "Nothing outstanding right now."
                  }
                />
              )}
            </Card>
          ))}
          {data.notes.length > 0 && (
            <ul className="space-y-1 text-helper text-slate">
              {data.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
