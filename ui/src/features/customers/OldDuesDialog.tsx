import { useState } from "react";
import { formatINR } from "@erp-software/shared";
import { Button } from "@/components/ui/Button";
import { Field, FormGrid, Input, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAddOldDues } from "@/features/invoices/api";
import { ApiError } from "@/lib/api-client";
import type { Customer } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

const today = () => new Date().toLocaleDateString("en-CA");

// What the customer already owed before the shop started using this software (from the old
// ledger book). Saved as an "Old dues" bill they can pay off like any other bill.
export function OldDuesDialog({ customer, open, onClose }: { customer: Customer; open: boolean; onClose: () => void }) {
  return open ? <OldDuesForm customer={customer} onClose={onClose} /> : null;
}

function OldDuesForm({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [asOfDate, setAsOfDate] = useState(today());
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const add = useAddOldDues();
  const toast = useToast();
  const value = Number(amount);

  const submit = async () => {
    if (!Number.isFinite(value) || value <= 0) return setErrors({ amount: "Enter the amount they owe" });
    if (!asOfDate) return setErrors({ asOfDate: "Choose a date" });
    if (asOfDate > today()) return setErrors({ asOfDate: "Can't be a future date" });
    try {
      const bill = await add.mutateAsync({
        customerId: customer.id,
        amount: value,
        asOfDate,
        note: note.trim() || null,
      });
      toast({ message: `Old dues of ${formatINR(value, { exact: true })} added (${bill.number})` });
      onClose();
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
      else toast({ message: errorMessage(err), tone: "error" });
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Add old dues for ${customer.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={add.isPending} loadingText="Saving…" onClick={() => void submit()}>
            Add {value > 0 ? formatINR(value, { exact: true }) : "old dues"}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p className="text-body text-slate">
          Money this customer already owed before you started using this software, for example from your old ledger
          book. It is added to their dues and can be collected like any bill. It is not a sale, so it doesn't count in
          sales or GST.
        </p>
        <FormGrid>
          <Field label="Amount they owe" required error={errors.amount}>
            {(p) => (
              <Input
                {...p}
                autoFocus
                type="number"
                min={0}
                step="0.01"
                align="right"
                suffix="₹"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setErrors({});
                }}
              />
            )}
          </Field>
          <Field
            label="Owed since"
            required
            error={errors.asOfDate}
            helper={`Due ${customer.creditDays} ${customer.creditDays === 1 ? "day" : "days"} after this date`}
          >
            {(p) => (
              <Input
                {...p}
                type="date"
                max={today()}
                value={asOfDate}
                onChange={(e) => {
                  setAsOfDate(e.target.value);
                  setErrors({});
                }}
              />
            )}
          </Field>
          <Field
            label="Note"
            error={errors.note}
            helper="For example: page 12 of the old ledger"
            className="sm:col-span-2"
          >
            {(p) => <Textarea {...p} rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
        </FormGrid>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
