import { useState } from "react";
import type { Customer } from "@/lib/types";
import { Link, useNavigate, useParams } from "react-router";
import { FileText, NotebookPen, Pencil } from "lucide-react";
import { CUSTOMER_TYPE_LABELS, formatINR, formatMobile, stateName } from "@erp-software/shared";
import { useAuth } from "@/app/auth";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DescriptionList, PageHeader } from "@/components/ui/Controls";
import { Menu } from "@/components/ui/Menu";
import { ConfirmDialog } from "@/components/ui/Modal";
import { EmptyState, ErrorBanner, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useCustomerCredit, useInvoices } from "@/features/invoices/api";
import { InvoiceStatusBadge } from "@/features/invoices/components/common";
import { Pagination } from "@/components/ui/DataTable";
import { errorMessage, formatDate, formatDateTime } from "@/lib/utils";
import { useCustomer, useDeleteCustomer } from "./api";
import { customerTypeTone } from "./CustomersPage";
import { OldDuesDialog } from "./OldDuesDialog";

export function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { can } = useAuth();
  const query = useCustomer(id);
  const remove = useDeleteCustomer();
  const [confirming, setConfirming] = useState(false);
  const [addingDues, setAddingDues] = useState(false);

  if (query.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }
  if (query.error || !query.data) {
    return (
      <ErrorBanner
        title="Couldn't load this customer"
        message={errorMessage(query.error)}
        onRetry={() => query.refetch()}
      />
    );
  }
  const c = query.data;

  const onDelete = async () => {
    try {
      await remove.mutateAsync(c.id);
      toast({ message: `${c.name} deleted` });
      navigate("/customers");
    } catch (err) {
      toast({ message: errorMessage(err), tone: "error" });
      setConfirming(false);
    }
  };

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <Link to="/customers" className="hover:text-navy-700">
              Customers
            </Link>{" "}
            / {c.name}
          </>
        }
        title={c.name}
        badge={<Badge tone={customerTypeTone[c.type]}>{CUSTOMER_TYPE_LABELS[c.type]}</Badge>}
        description={`${formatMobile(c.mobile)}${c.city ? ` · ${c.city}` : ""}`}
        actions={
          (can("customer.manage") || can("dues.opening")) && (
            <>
              {can("dues.opening") && (
                <Button variant="outline" icon={<NotebookPen className="size-4" />} onClick={() => setAddingDues(true)}>
                  Add old dues
                </Button>
              )}
              {can("customer.manage") && (
                <Button
                  variant="outline"
                  icon={<Pencil className="size-4" />}
                  onClick={() => navigate(`/customers/${c.id}/edit`)}
                >
                  Edit
                </Button>
              )}
              {can("customer.manage") && (
                <Menu items={[{ label: "Delete customer", destructive: true, onSelect: () => setConfirming(true) }]} />
              )}
            </>
          )
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <CardBody>
              <DescriptionList
                items={[
                  { label: "Mobile", value: formatMobile(c.mobile) },
                  { label: "Alternate phone", value: c.alternatePhone && formatMobile(c.alternatePhone) },
                  { label: "Email", value: c.email },
                  { label: "GSTIN", value: c.gstin },
                  { label: "Address", value: [c.address, c.city, c.pincode].filter(Boolean).join(", ") },
                  {
                    label: "Place of supply",
                    value: c.stateCode ? `${c.stateCode} · ${stateName(c.stateCode)}` : "Same as branch",
                  },
                  { label: "Notes", value: c.notes },
                  { label: "Added", value: formatDateTime(c.createdAt) },
                ]}
              />
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Dues (pay later)" />
            <CardBody className="space-y-3">
              <div className="flex justify-between text-body">
                <span className="text-slate">Maximum dues allowed</span>
                <span className="font-semibold tabular">
                  {Number(c.creditLimit) > 0 ? formatINR(c.creditLimit, { exact: true }) : "Must pay full bill"}
                </span>
              </div>
              <div className="flex justify-between text-body">
                <span className="text-slate">Days to clear dues</span>
                <span className="tabular">{c.creditDays}</span>
              </div>
              <CreditSummary customer={c} />
            </CardBody>
          </Card>
          <CustomerInvoices customerId={c.id} />
        </div>
      </div>

      <OldDuesDialog customer={c} open={addingDues} onClose={() => setAddingDues(false)} />
      <ConfirmDialog
        open={confirming}
        title={`Delete ${c.name}?`}
        body="They disappear from customer search. Past records keep their name. This can't be undone."
        cancelLabel="Keep customer"
        confirmLabel="Delete customer"
        loading={remove.isPending}
        onConfirm={onDelete}
        onClose={() => setConfirming(false)}
      />
    </>
  );
}

// Outstanding and available credit from the customer's open invoices.
function CreditSummary({ customer }: { customer: Customer }) {
  const { can } = useAuth();
  const allowed = can("invoice.view", "invoice.create", "pos.use");
  const credit = useCustomerCredit(allowed ? customer.id : undefined);
  if (!allowed) return null;
  if (credit.isPending) return <Skeleton className="h-10 w-full rounded-input" />;
  if (!credit.data) return null;
  const owed = Number(credit.data.outstanding);
  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="flex justify-between text-body">
        <span className="text-slate">Total dues now</span>
        <span className={owed > 0 ? "font-semibold text-warning tabular" : "tabular"}>
          {formatINR(credit.data.outstanding, { exact: true })}
        </span>
      </div>
      {Number(customer.creditLimit) > 0 && (
        <div className="flex justify-between text-body">
          <span className="text-slate">Can still owe</span>
          <span className="font-semibold tabular">{formatINR(credit.data.availableCredit, { exact: true })}</span>
        </div>
      )}
    </div>
  );
}

// The customer's invoices across the user's branches, newest first.
function CustomerInvoices({ customerId }: { customerId: string }) {
  const { can, me } = useAuth();
  const [page, setPage] = useState(1);
  const allowed = can("invoice.view", "invoice.create");
  const query = useInvoices(
    { page, customerId, branchId: (me?.branches.length ?? 0) > 1 ? "all" : undefined },
    { limit: 10, enabled: allowed },
  );
  if (!allowed) return null;

  return (
    <Card>
      <CardHeader title="Invoices" subtitle={query.data ? `${query.data.meta.total} in total` : undefined} />
      {query.isPending ? (
        <div className="space-y-2 p-5">
          <Skeleton className="h-10 w-full rounded-input" />
          <Skeleton className="h-10 w-full rounded-input" />
        </div>
      ) : query.error ? (
        <div className="p-5">
          <ErrorBanner
            title="Couldn't load invoices"
            message={errorMessage(query.error)}
            onRetry={() => query.refetch()}
          />
        </div>
      ) : !query.data?.data.length ? (
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description="Bills for this customer from the POS, and any old dues you add, show here."
        />
      ) : (
        <>
          <ul className="divide-y divide-border">
            {query.data.data.map((inv) => (
              <li key={inv.id}>
                <Link to={`/invoices/${inv.id}`} className="flex items-center gap-3 px-6 py-3 hover:bg-navy-50">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-navy-700">
                      {inv.number}
                      {inv.kind === "OPENING_BALANCE" && <span className="ml-2 text-helper text-slate">Old dues</span>}
                    </p>
                    <p className="text-helper text-slate">
                      {formatDate(inv.invoiceDate)}
                      {Number(inv.balanceDue) > 0 && ` · ${formatINR(inv.balanceDue, { exact: true })} due`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-body font-semibold tabular">{formatINR(inv.grandTotal, { exact: true })}</p>
                    <InvoiceStatusBadge status={inv.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination meta={query.data.meta} onPage={setPage} />
        </>
      )}
    </Card>
  );
}
