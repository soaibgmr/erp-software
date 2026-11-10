import { useState } from "react";
import { formatINR, PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from "@erp-software/shared";
import { Button } from "@/components/ui/Button";
import { Field, FormGrid, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api-client";
import type { InvoiceDetail, Payment } from "@/lib/types";
import { errorMessage } from "@/lib/utils";
import { useRecordPayment, useReversePayment } from "../api";

// "Collect payment": method, amount (defaults to the balance), reference.
export function CollectPaymentDialog({
  invoice,
  open,
  onClose,
}: {
  invoice: InvoiceDetail;
  open: boolean;
  onClose: () => void;
}) {
  return open ? <CollectForm invoice={invoice} onClose={onClose} /> : null;
}

function CollectForm({ invoice, onClose }: { invoice: InvoiceDetail; onClose: () => void }) {
  const [mode, setMode] = useState<PaymentMethod>("CASH");
  const [amount, setAmount] = useState(invoice.balanceDue);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const record = useRecordPayment(invoice.id);
  const toast = useToast();
  const due = Number(invoice.balanceDue);

  const submit = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setErrors({ amount: "Enter an amount" });
    if (value > due) return setErrors({ amount: `Only ${formatINR(due, { exact: true })} is due` });
    try {
      await record.mutateAsync({ mode, amount: value, reference: reference.trim() || null, note: note.trim() || null });
      toast({ message: `${formatINR(value, { exact: true })} recorded on ${invoice.number}` });
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
      title={`Collect payment for ${invoice.number}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" loading={record.isPending} loadingText="Saving…" onClick={() => void submit()}>
            Record {Number(amount) > 0 ? formatINR(Number(amount), { exact: true }) : "payment"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-body text-slate">
          Balance due <span className="font-semibold text-ink tabular">{formatINR(due, { exact: true })}</span>
        </p>
        <FormGrid>
          <Field label="Method" error={errors.mode}>
            {(p) => (
              <Select {...p} value={mode} onChange={(e) => setMode(e.target.value as PaymentMethod)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Amount" required error={errors.amount}>
            {(p) => (
              <Input
                {...p}
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
            label="Reference"
            error={errors.reference}
            helper={mode === "CASH" ? undefined : "UPI ref., card slip, cheque or UTR number"}
            className="sm:col-span-2"
          >
            {(p) => <Input {...p} maxLength={60} value={reference} onChange={(e) => setReference(e.target.value)} />}
          </Field>
          <Field label="Note" error={errors.note} className="sm:col-span-2">
            {(p) => <Textarea {...p} rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
        </FormGrid>
      </div>
    </Modal>
  );
}

// Reversal: a negative row that undoes a wrong receipt; the original stays on record.
export function ReversePaymentDialog({ payment, onClose }: { payment: Payment | null; onClose: () => void }) {
  return payment ? <ReverseForm key={payment.id} payment={payment} onClose={onClose} /> : null;
}

function ReverseForm({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const reverse = useReversePayment();
  const toast = useToast();
  const amount = formatINR(payment.amount, { exact: true });

  const submit = async () => {
    if (!reason.trim()) return setError("Enter why this payment is being reversed");
    try {
      await reverse.mutateAsync({ paymentId: payment.id, reason: reason.trim() });
      toast({ message: `${amount} ${PAYMENT_METHOD_LABELS[payment.mode]} payment reversed` });
      onClose();
    } catch (err) {
      toast({ message: errorMessage(err), tone: "error" });
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Reverse the ${amount} ${PAYMENT_METHOD_LABELS[payment.mode]} payment?`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Keep payment
          </Button>
          <Button variant="danger" loading={reverse.isPending} loadingText="Reversing…" onClick={() => void submit()}>
            Reverse payment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-body text-slate">
          A reversal entry is added and the balance due goes back up by {amount}. The original payment stays on record.
        </p>
        <Field label="Reason" required error={error}>
          {(p) => (
            <Textarea
              {...p}
              rows={3}
              maxLength={200}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError(undefined);
              }}
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}
