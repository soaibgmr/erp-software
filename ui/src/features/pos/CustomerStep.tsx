import { useState, type Ref } from "react";
import { ArrowRight } from "lucide-react";
import { loginIdentifierSchema } from "@erp-software/shared";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useSaveCustomer } from "@/features/customers/api";
import { api, ApiError } from "@/lib/api-client";
import type { Customer, CustomerCredit } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

// Step 1 of every bill, on its own screen: who is the customer? Mobile number or email, then OK.
// A new customer is added right here (name + mobile). The billing screen opens once someone is attached.
export function CustomerStep({
  inputRef,
  onAttach,
  waitingItems,
  onHeld,
  reprint,
}: {
  inputRef?: Ref<HTMLInputElement>;
  onAttach: (c: CustomerCredit) => void;
  // Items already in the cart (a resumed held bill, or after "Change customer").
  waitingItems: number;
  onHeld: () => void;
  reprint?: { number: string; onPrint: () => void };
}) {
  const toast = useToast();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ mobile: string; email: string } | null>(null);

  const attachById = async (id: string) => {
    onAttach(await api.get<CustomerCredit>(`/invoices/customer-credit/${id}`));
  };

  const find = async () => {
    const check = loginIdentifierSchema.safeParse(value.trim());
    if (!check.success) {
      setError("Enter a 10-digit mobile number or an email");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const found = await api.get<Customer | null>("/customers/lookup", { q: check.data });
      if (found) await attachById(found.id);
      else setAdding(check.data.includes("@") ? { mobile: "", email: check.data } : { mobile: check.data, email: "" });
    } catch (err) {
      toast({ message: errorMessage(err), tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto p-4">
      <div className="w-full max-w-[420px]">
        <div className="rounded-card border border-border bg-surface p-6 sm:p-8">
          {adding ? (
            <QuickAdd
              initial={adding}
              onBack={() => setAdding(null)}
              onAdded={(id) =>
                attachById(id).catch((err: unknown) => toast({ message: errorMessage(err), tone: "error" }))
              }
            />
          ) : (
            <form
              noValidate
              className="text-center"
              onSubmit={(e) => {
                e.preventDefault();
                void find();
              }}
            >
              <h1 className="text-page font-bold text-ink">Who is the customer?</h1>
              <Input
                ref={inputRef}
                autoFocus
                autoComplete="off"
                aria-label="Customer mobile number or email"
                placeholder="Mobile number or email"
                className="mt-6 h-14 text-center text-section"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "pos-customer-hint" : undefined}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
              />
              {error && (
                <p id="pos-customer-hint" role="alert" className="mt-2 text-helper text-danger">
                  {error}
                </p>
              )}
              <Button type="submit" size="lg" className="mt-5 w-full" loading={busy} loadingText="Finding…">
                Start billing
              </Button>
              {waitingItems > 0 && (
                <p className="mt-4 text-helper text-slate">
                  {waitingItems} item{waitingItems === 1 ? "" : "s"} already in the cart.
                </p>
              )}
            </form>
          )}
        </div>

        {!adding && (
          <div className="mt-5 flex items-center justify-center gap-5 text-helper text-slate">
            <button type="button" onClick={onHeld} className="hover:text-ink hover:underline">
              Held bills (F6)
            </button>
            {reprint && (
              <button type="button" onClick={reprint.onPrint} className="hover:text-ink hover:underline">
                Reprint {reprint.number}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function QuickAdd({
  initial,
  onBack,
  onAdded,
}: {
  initial: { mobile: string; email: string };
  onBack: () => void;
  onAdded: (id: string) => void;
}) {
  const save = useSaveCustomer();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState(initial.mobile);
  const [email, setEmail] = useState(initial.email);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    setErrors({});
    setFormError(null);
    try {
      const created = await save.mutateAsync({ type: "RETAIL", name, mobile, email });
      onAdded(created.id);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
      else setFormError(errorMessage(err));
    }
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h1 className="text-center text-page font-bold text-ink">New customer</h1>
      <p className="mt-1 text-center text-body text-slate">
        We don't have {initial.mobile || initial.email} yet. Add their name to start the bill.
      </p>
      {formError && <p className="mt-3 text-helper text-danger">{formError}</p>}
      <div className="mt-6 space-y-4">
        <Field label="Customer name" required error={errors.name}>
          {(p) => (
            <Input
              {...p}
              autoFocus
              autoComplete="off"
              className="h-11"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
        <Field label="Mobile number" required error={errors.mobile}>
          {(p) => (
            <Input
              {...p}
              inputMode="tel"
              autoComplete="off"
              className="h-11"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />
          )}
        </Field>
        <Field label="Email" helper="Optional. The bill is emailed here." error={errors.email}>
          {(p) => (
            <Input
              {...p}
              type="email"
              autoComplete="off"
              className="h-11"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
      </div>
      <div className="mt-6 flex gap-2">
        <Button type="button" variant="outline" size="lg" onClick={onBack}>
          Back
        </Button>
        <Button
          type="submit"
          size="lg"
          className="flex-1"
          loading={save.isPending}
          loadingText="Saving…"
          disabled={!name.trim() || !mobile.trim()}
          icon={<ArrowRight className="size-5" />}
        >
          Save and start billing
        </Button>
      </div>
    </form>
  );
}
