import { useState } from "react";
import { formatINR } from "@erp-software/shared";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/utils";
import { useCancelInvoice } from "../api";

// PRD M6.5: title is a question, the body states the consequence, a reason is required.
export function CancelInvoiceDialog({
  invoice,
  onClose,
}: {
  invoice: { id: string; number: string; itemCount: number; paidTotal: string; oldDues?: boolean } | null;
  onClose: () => void;
}) {
  return invoice ? <CancelForm key={invoice.id} invoice={invoice} onClose={onClose} /> : null;
}

function CancelForm({
  invoice,
  onClose,
}: {
  invoice: { id: string; number: string; itemCount: number; paidTotal: string; oldDues?: boolean };
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const cancel = useCancelInvoice();
  const toast = useToast();
  const paid = Number(invoice.paidTotal);
  const what = invoice.oldDues ? "old dues" : "invoice";

  const submit = async () => {
    if (!reason.trim()) {
      setError("Enter the reason for cancelling");
      return;
    }
    try {
      await cancel.mutateAsync({ id: invoice.id, reason: reason.trim() });
      toast({ message: `${invoice.oldDues ? "Old dues" : "Invoice"} ${invoice.number} cancelled` });
      onClose();
    } catch (err) {
      toast({ message: errorMessage(err), tone: "error" });
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Cancel ${what} ${invoice.number}?`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Keep {what}
          </Button>
          <Button variant="danger" loading={cancel.isPending} loadingText="Cancelling…" onClick={() => void submit()}>
            Cancel {what}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {invoice.oldDues ? (
          <p className="text-body text-slate">
            These old dues will no longer count in the customer's dues. The number is kept. This can't be undone.
          </p>
        ) : (
          <p className="text-body text-slate">
            Stock for {invoice.itemCount} {invoice.itemCount === 1 ? "item" : "items"} will be returned to inventory.
            {paid > 0 && ` ${formatINR(paid, { exact: true })} received will be recorded as refunded.`} The invoice
            number is kept. This can't be undone.
          </p>
        )}
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
