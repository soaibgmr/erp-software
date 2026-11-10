import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { AlertTriangle } from "lucide-react";
import { formatQty } from "@erp-software/shared";
import { useAuth } from "@/app/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Controls";
import { Field, FormGrid, Select, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useBranches } from "@/features/settings/api";
import { errorMessage } from "@/lib/utils";
import { useCreateTransfer } from "../api";
import { lineErrors, LineEditor, serverLineErrors, type DraftLine } from "../components/LineEditor";

export function TransferFormPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { branch } = useAuth();
  const branches = useBranches(false);
  const create = useCreateTransfer();

  const [toBranchId, setToBranchId] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [errors, setErrors] = useState<{ lines: Record<number, string>; fields: Record<string, string> }>({
    lines: {},
    fields: {},
  });

  const destinations = (branches.data ?? []).filter((b) => b.isActive && b.id !== branch?.id);
  const short = lines.filter((l) => Number(l.quantity) > Number(l.item.stock?.available ?? 0));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fields: Record<string, string> = {};
    if (!toBranchId) fields.toBranchId = "Choose the receiving branch";
    if (!lines.length) fields.lines = "Add at least one item";
    const lineErrs = lineErrors(lines, false);
    setErrors({ lines: lineErrs, fields });
    if (Object.keys(fields).length || Object.keys(lineErrs).length) return;

    try {
      const t = await create.mutateAsync({
        toBranchId,
        note: note.trim(),
        lines: lines.map((l) => ({ itemId: l.item.id, quantity: Number(l.quantity) })),
      });
      toast({ message: `${t.number} dispatched to ${t.toBranch.name}` });
      navigate(`/inventory/transfers/${t.id}`);
    } catch (err) {
      const mapped = serverLineErrors(err);
      setErrors(mapped);
      if (!Object.keys(mapped.lines).length && !Object.keys(mapped.fields).length)
        toast({ message: errorMessage(err), tone: "error" });
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
            <Link to="/inventory/transfers" className="hover:text-navy-700">
              Transfers
            </Link>{" "}
            / New
          </>
        }
        title="New stock transfer"
        description={branch ? `From ${branch.name}. Stock leaves this branch as soon as you dispatch.` : undefined}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader title="Items" subtitle="Quantities to send." />
          <CardBody className="space-y-4">
            <LineEditor lines={lines} onChange={setLines} errors={errors.lines} />
            {errors.fields.lines && <p className="text-helper text-danger">{errors.fields.lines}</p>}
            {short.length > 0 && (
              <div className="flex gap-3 rounded-card border border-warning-50 bg-warning-50 p-4 text-helper text-warning">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>
                  More than available:{" "}
                  {short.map((l) => `${l.item.name} (${formatQty(l.item.stock?.available ?? 0)} available)`).join(", ")}
                  . Transfers can't take stock below zero.
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Destination" />
          <CardBody>
            <FormGrid className="sm:grid-cols-1">
              <Field
                label="To branch"
                required
                error={errors.fields.toBranchId}
                helper={
                  branches.isSuccess && !destinations.length
                    ? "There's no other active branch you can send to."
                    : undefined
                }
              >
                {(p) => (
                  <Select {...p} value={toBranchId} onChange={(e) => setToBranchId(e.target.value)}>
                    <option value="">Choose a branch</option>
                    {destinations.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Note" error={errors.fields.note} helper="E.g. driver name or vehicle number.">
                {(p) => (
                  <Textarea {...p} rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
                )}
              </Field>
            </FormGrid>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 flex justify-end gap-3 border-t border-border pt-5">
        <Button variant="ghost" onClick={() => navigate("/inventory/transfers")}>
          Cancel
        </Button>
        <Button type="submit" loading={create.isPending} loadingText="Dispatching…">
          Dispatch transfer
        </Button>
      </div>
    </form>
  );
}
