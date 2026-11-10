import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, BarChart3, BookOpen, FileSpreadsheet, Landmark, Package } from "lucide-react";
import {
  REPORT_GROUPS,
  REPORTS,
  TALLY_VOUCHER_KINDS,
  type ReportGroup,
  type TallyVoucherKind,
} from "@erp-software/shared";
import { useAuth } from "@/app/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader, SegmentedControl } from "@/components/ui/Controls";
import { Checkbox, Field, Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/utils";
import { downloadTally, type BranchScopeOption } from "./api";
import { monthStart, today } from "./dates";

const groupIcon: Record<ReportGroup, typeof BarChart3> = {
  Sales: BarChart3,
  GST: Landmark,
  Stock: Package,
};

const VOUCHER_LABELS: Record<TallyVoucherKind, string> = {
  sales: "Sales and credit notes",
  payments: "Customer receipts and refunds",
};

// Reports index (PRD M10): every report by group, plus the Tally export.
export function ReportsPage() {
  const { branch } = useAuth();
  return (
    <>
      <PageHeader
        title="Reports"
        description={`Sales, GST and stock reports${branch ? ` for ${branch.name} or all branches` : ""}.`}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        {REPORT_GROUPS.map((group) => {
          const Icon = groupIcon[group];
          return (
            <Card key={group}>
              <CardHeader
                title={
                  <span className="inline-flex items-center gap-2">
                    <Icon className="size-[18px] text-navy-700" />
                    {group}
                  </span>
                }
              />
              <ul className="p-2">
                {REPORTS.filter((r) => r.group === group).map((r) => (
                  <li key={r.name}>
                    <Link
                      to={`/reports/${r.name}`}
                      className="flex items-center gap-3 rounded-input px-4 py-3 hover:bg-navy-50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-ink">{r.title}</span>
                        <span className="block text-helper text-slate">{r.description}</span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-slate" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
        <TallyExportCard />
      </div>
    </>
  );
}

function TallyExportCard() {
  const { me } = useAuth();
  const toast = useToast();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [scope, setScope] = useState<BranchScopeOption>("branch");
  const [kinds, setKinds] = useState<TallyVoucherKind[]>([...TALLY_VOUCHER_KINDS]);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const name = await downloadTally({ from, to, scope }, kinds);
      toast({ message: `${name} downloaded` });
    } catch (err) {
      toast({ message: errorMessage(err), tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <BookOpen className="size-[18px] text-navy-700" />
            Tally export
          </span>
        }
        subtitle="Vouchers XML for Tally (Gateway → Import → Vouchers)."
      />
      <CardBody className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From">
            {(f) => <Input {...f} type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />}
          </Field>
          <Field label="To">
            {(f) => <Input {...f} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />}
          </Field>
        </div>
        {(me?.branches.length ?? 0) > 1 && (
          <SegmentedControl<BranchScopeOption>
            label="Branches"
            value={scope}
            onChange={setScope}
            options={[
              { value: "branch", label: "This branch" },
              { value: "all", label: "All branches" },
            ]}
          />
        )}
        <div className="space-y-2">
          {TALLY_VOUCHER_KINDS.map((k) => (
            <Checkbox
              key={k}
              label={VOUCHER_LABELS[k]}
              checked={kinds.includes(k)}
              onChange={(e) => setKinds((cur) => (e.target.checked ? [...cur, k] : cur.filter((x) => x !== k)))}
            />
          ))}
        </div>
        <p className="text-helper text-slate">
          Create these ledgers in Tally first: party names, Sales @ n%, Output CGST, SGST, IGST,
          Cash, Bank, Cash Sales and Round Off.
        </p>
        <Button
          onClick={run}
          loading={busy}
          disabled={!kinds.length || !from || !to}
          icon={<FileSpreadsheet className="size-4" />}
        >
          Download XML
        </Button>
      </CardBody>
    </Card>
  );
}
