import { useState } from "react";
import { formatDocumentNumber } from "@erp-software/shared";
import { useAuth } from "@/app/auth";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { ErrorBanner, TableSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api-client";
import type { DocumentSequence } from "@/lib/types";
import { errorMessage } from "@/lib/utils";
import { useSequences, useUpdateSequence } from "./api";

export function NumberSeriesPage() {
  const { me, branch } = useAuth();
  const [branchId, setBranchId] = useState(branch?.id);
  const query = useSequences(branchId);
  const fyLabel = query.data?.[0]?.financialYearLabel;

  return (
    <Card>
      <CardHeader
        title="Number series"
        subtitle={`Numbers restart every financial year (April–March) and never skip.${fyLabel ? ` Showing ${fyLabel}.` : ""}`}
        actions={
          me && me.branches.length > 1 ? (
            <Select
              aria-label="Branch"
              className="h-8 w-56 text-helper"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              {me.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          ) : undefined
        }
      />
      {query.error ? (
        <div className="p-5">
          <ErrorBanner
            title="Couldn't load number series"
            message={errorMessage(query.error)}
            onRetry={() => query.refetch()}
          />
        </div>
      ) : !query.data ? (
        <TableSkeleton rows={5} columns={5} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-body">
            <thead>
              <tr className="border-b border-border text-left">
                {["Document", "Prefix", "Digits", "Next number", ""].map((h) => (
                  <th key={h} className="eyebrow h-11 px-6 text-slate">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.data.map((s) => (
                // Keyed on the saved format so the row's inputs reset when it changes on the server.
                <SeriesRow key={`${s.branchId}:${s.docType}:${s.prefix}:${s.padding}`} series={s} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function SeriesRow({ series }: { series: DocumentSequence }) {
  const toast = useToast();
  const update = useUpdateSequence();
  const [prefix, setPrefix] = useState(series.prefix);
  const [padding, setPadding] = useState(series.padding);
  const [error, setError] = useState<string>();

  const dirty = prefix !== series.prefix || padding !== series.padding;
  const preview = /^[A-Za-z]{1,6}$/.test(prefix)
    ? formatDocumentNumber(prefix.toUpperCase(), series.financialYear, series.nextNumber, padding)
    : series.preview;

  const onSave = async () => {
    setError(undefined);
    try {
      await update.mutateAsync({ branchId: series.branchId, docType: series.docType, body: { prefix, padding } });
      toast({ message: `${series.label} series saved` });
    } catch (err) {
      setError(err instanceof ApiError ? (err.fieldErrors.prefix ?? err.message) : errorMessage(err));
    }
  };

  return (
    <tr className="border-b border-border align-top last:border-0">
      <td className="px-6 py-3">
        <p className="font-medium text-ink">{series.label}</p>
        {series.inUse && (
          <Badge tone="info" className="mt-1">
            In use · locked until next FY
          </Badge>
        )}
      </td>
      <td className="px-6 py-3">
        <Input
          aria-label={`${series.label} prefix`}
          className="w-28 uppercase"
          maxLength={6}
          value={prefix}
          disabled={series.inUse}
          onChange={(e) => setPrefix(e.target.value.toUpperCase())}
          aria-invalid={error ? true : undefined}
        />
        {error && <p className="mt-1 max-w-64 text-helper text-danger">{error}</p>}
      </td>
      <td className="px-6 py-3">
        <Select
          aria-label={`${series.label} digits`}
          className="w-24"
          value={padding}
          disabled={series.inUse}
          onChange={(e) => setPadding(Number(e.target.value))}
        >
          {[3, 4, 5, 6, 7, 8].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </td>
      <td className="px-6 py-3 pt-5 font-mono text-helper text-ink">{preview}</td>
      <td className="px-6 py-3 text-right">
        {!series.inUse && (
          <Button size="sm" variant="outline" disabled={!dirty} loading={update.isPending} onClick={onSave}>
            Save
          </Button>
        )}
      </td>
    </tr>
  );
}
