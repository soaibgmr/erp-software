import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Plus, Search, Users } from "lucide-react";
import { CUSTOMER_TYPE_LABELS, CUSTOMER_TYPES, formatINR, formatMobile, type CustomerType } from "@automobile/shared";
import { useAuth } from "@/app/auth";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Controls";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Input, Select } from "@/components/ui/Field";
import { EmptyState, NoResults } from "@/components/ui/States";
import { useDebounced } from "@/lib/hooks";
import type { Customer } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { useCustomers } from "./api";

export const customerTypeTone: Record<CustomerType, Tone> = { RETAIL: "neutral", FLEET: "info", B2B: "highlight" };

export function CustomersPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page") ?? 1);
  const type = (params.get("type") as CustomerType | null) ?? undefined;
  const [search, setSearch] = useState(params.get("search") ?? "");
  const debounced = useDebounced(search.trim());

  // Keep the search in the URL so the command palette can deep-link and back/forward works.
  useEffect(() => {
    setParams(
      (p) => {
        if (debounced) p.set("search", debounced);
        else p.delete("search");
        if (debounced !== (p.get("search") ?? "")) p.delete("page");
        return p;
      },
      { replace: true },
    );
  }, [debounced, setParams]);

  const query = useCustomers({ page, search: debounced || undefined, type });
  const filtered = Boolean(debounced || type);

  const setParam = (key: string, value: string | undefined) =>
    setParams((p) => {
      if (value) p.set(key, value);
      else p.delete(key);
      if (key !== "page") p.delete("page");
      return p;
    });

  const columns: Column<Customer>[] = [
    {
      key: "name",
      header: "Customer",
      cell: (c) => (
        <div className="min-w-0">
          <p className="font-medium text-navy-700">{c.name}</p>
          <p className="text-helper text-slate">{[c.city, c.gstin].filter(Boolean).join(" · ") || "—"}</p>
        </div>
      ),
    },
    {
      key: "mobile",
      header: "Mobile",
      cell: (c) => <span className="tabular whitespace-nowrap">{formatMobile(c.mobile)}</span>,
    },
    {
      key: "type",
      header: "Type",
      cell: (c) => <Badge tone={customerTypeTone[c.type]}>{CUSTOMER_TYPE_LABELS[c.type]}</Badge>,
    },
    {
      key: "credit",
      header: "Max dues",
      align: "right",
      cell: (c) =>
        Number(c.creditLimit) > 0 ? (
          `${formatINR(c.creditLimit)} · ${c.creditDays}d`
        ) : (
          <span className="text-muted">Cash only</span>
        ),
    },
    {
      key: "created",
      header: "Added",
      align: "right",
      cell: (c) => <span className="text-slate">{formatDate(c.createdAt)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Customers"
        description="Retail, fleet and business customers shared across branches."
        actions={
          can("customer.manage") && (
            <Button icon={<Plus className="size-4" />} onClick={() => navigate("/customers/new")}>
              New customer
            </Button>
          )
        }
      />
      <Card>
        <div className="flex flex-wrap gap-3 border-b border-border p-4">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate" />
            <Input
              aria-label="Search customers"
              placeholder="Search name, mobile, GSTIN or city"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            aria-label="Customer type"
            className="w-48"
            value={type ?? ""}
            onChange={(e) => setParam("type", e.target.value || undefined)}
          >
            <option value="">All types</option>
            {CUSTOMER_TYPES.map((t) => (
              <option key={t} value={t}>
                {CUSTOMER_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
        <DataTable
          columns={columns}
          rows={query.data?.data}
          rowKey={(c) => c.id}
          loading={query.isPending}
          error={query.error}
          onRetry={() => query.refetch()}
          onRowClick={(c) => navigate(`/customers/${c.id}`)}
          empty={
            filtered ? (
              <NoResults
                query={debounced || undefined}
                hint="Try the mobile number, or clear the type filter."
                onClear={() => {
                  setSearch("");
                  setParams({});
                }}
              />
            ) : (
              <EmptyState
                icon={Users}
                title="No customers yet"
                description="Add a customer when they first buy. Their invoices and payments collect here."
                action={
                  can("customer.manage") && <Button onClick={() => navigate("/customers/new")}>New customer</Button>
                }
              />
            )
          }
        />
        <Pagination meta={query.data?.meta} onPage={(p) => setParam("page", String(p))} />
      </Card>
    </>
  );
}
