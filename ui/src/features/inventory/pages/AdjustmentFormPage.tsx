import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Info } from "lucide-react";
import {
  formatINR,
  STOCK_ADJUSTMENT_REASON_LABELS,
  STOCK_ADJUSTMENT_REASONS,
  type StockAdjustmentReason,
} from "@automobile/shared";
import { useAuth } from "@/app/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Controls";
import { Field, FormGrid, Select, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useSettings } from "@/features/settings/api";
import { errorMessage } from "@/lib/utils";
import { useCreateAdjustment, useItem } from "../api";
import { lineErrors, LineEditor, serverLineErrors, toSearchResult, type DraftLine } from "../components/LineEditor";

export function AdjustmentFormPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { can, branch } = useAuth();
  const [params] = useSearchParams();
  const prefillId = params.get("itemId") ?? undefined;
  const prefill = useItem(prefillId);
  const settings = useSettings();
  const create = useCreateAdjustment();

  const [reason, setReason] = useState<StockAdjustmentReason>("COUNT_CORRECTION");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [errors, setErrors] = useState<{ lines: Record<number, string>; fields: Record<string, string> }>({
    lines: {},
    fields: {},
  });
  const prefilled = useRef(false);

  useEffect(() => {
    if (prefill.data && !prefilled.current) {
      prefilled.current = true;
      setLines([{ item: toSearchResult(prefill.data), quantity: "" }]);
    }
  }, [prefill.data]);

  const limit = settings.data?.inventory?.adjustmentApprovalLimit;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fields: Record<string, string> = {};
    if (!lines.length) fields.lines = "Add at least one item";
    if (reason === "OTHER" && !note.trim()) fields.note = "Explain the reason";
    const lineErrs = lineErrors(lines, true);
    setErrors({ lines: lineErrs, fields });
    if (Object.keys(fields).length || Object.keys(lineErrs).length) return;

    try {
      const adj = await create.mutateAsync({
        reason,
        note: note.trim(),
        lines: lines.map((l) => ({ itemId: l.item.id, quantity: Number(l.quantity) })),
      });
      toast({ message: adj.status === "PENDING" ? `${adj.number} sent for approval` : `${adj.number} posted` });
      navigate(`/inventory/adjustments/${adj.id}`);
    } catch (err) {
      const mapped = serverLineErrors(err);
      setErrors(mapped);
      if (!Object.keys(mapped.lines).length && !Object.keys(mapped.fields).length)
        toast({ message: errorMessage(err), tone: "error" });
      else if (mapped.fields.lines) toast({ message: mapped.fields.lines, tone: "error" });
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader
        breadcrumb={
          <>
            <Link to="/inventory" className="hover:text-navy-700">
              Inventory
            </Link>{" "}
            /{" "}
            <Link to="/inventory/adjustments" className="hover:text-navy-700">
              Adjustments
            </Link>{" "}
            / New
          </>
        }
        title="New stock adjustment"
        description={branch ? `Changes stock in ${branch.name}.` : undefined}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader title="Items" subtitle="Enter the change: +5 adds five to stock, −2 removes two." />
          <CardBody>
            <LineEditor lines={lines} onChange={setLines} signed errors={errors.lines} />
            {errors.fields.lines && <p className="mt-2 text-helper text-danger">{errors.fields.lines}</p>}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Reason" />
            <CardBody>
              <FormGrid className="sm:grid-cols-1">
                <Field label="Reason" required error={errors.fields.reason}>
                  {(p) => (
                    <Select {...p} value={reason} onChange={(e) => setReason(e.target.value as StockAdjustmentReason)}>
                      {STOCK_ADJUSTMENT_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {STOCK_ADJUSTMENT_REASON_LABELS[r]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field
                  label="Note"
                  required={reason === "OTHER"}
                  error={errors.fields.note}
                  helper={
                    reason === "OTHER" ? "Required: explain what happened." : "Optional, shown in the stock ledger."
                  }
                >
                  {(p) => (
                    <Textarea {...p} rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
                  )}
                </Field>
              </FormGrid>
            </CardBody>
          </Card>

          {!can("stock.approve") && (
            <div className="flex gap-3 rounded-card border border-info-50 bg-info-50 p-4 text-helper text-info">
              <Info className="mt-0.5 size-4 shrink-0" />
              <p>
                Adjustments worth more than {limit !== undefined ? formatINR(limit) : "the approval limit"} at purchase
                price wait for a manager to approve them before stock changes.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3 border-t border-border pt-5">
        <Button variant="ghost" onClick={() => navigate("/inventory/adjustments")}>
          Cancel
        </Button>
        <Button type="submit" loading={create.isPending} loadingText="Saving…">
          Save adjustment
        </Button>
      </div>
    </form>
  );
}
