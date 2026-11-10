import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, KpiCard } from "@/components/ui/Card";
import { Chip, PageHeader, SegmentedControl } from "@/components/ui/Controls";
import { Field, FormGrid, Input, Select } from "@/components/ui/Field";
import { Menu } from "@/components/ui/Menu";
import { ConfirmDialog } from "@/components/ui/Modal";
import { EmptyState, ErrorBanner, NoResults, TableSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

const SWATCHES = [
  ["Navy 900", "bg-navy-900", "#0B1F3A · Sidebar"],
  ["Navy 700", "bg-navy-700", "#1A3A6B · Primary"],
  ["Navy 600", "bg-navy-600", "#2A5191 · Focus"],
  ["Navy 50", "bg-navy-50", "#F3F6FB · Row hover"],
  ["Yellow 500", "bg-yellow-500", "#F5B800 · Accent"],
  ["Yellow 400", "bg-yellow-400", "#FFC929 · Active"],
  ["Yellow 100", "bg-yellow-100", "#FFF1C2 · Highlight"],
  ["Yellow 700", "bg-yellow-700", "#8A5A00 · On tint"],
  ["Success", "bg-success", "#15803D"],
  ["Warning", "bg-warning", "#B45309"],
  ["Danger", "bg-danger", "#B91C1C"],
  ["Info", "bg-info", "#1D4ED8"],
] as const;

// /dev/components: the Design System v2 board rendered with the real components.
export function ComponentGallery() {
  const toast = useToast();
  const [fuel, setFuel] = useState("½");
  const [range, setRange] = useState("today");
  const [chips, setChips] = useState(new Set(["Periodic service", "Brakes", "AC"]));
  const [confirm, setConfirm] = useState(false);

  return (
    <>
      <PageHeader
        title="Design system"
        breadcrumb="Developer"
        description="Every primitive in its states. Compare with docs/DESIGN_SYSTEM.md."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Colors" />
          <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {SWATCHES.map(([name, cls, hint]) => (
              <div key={name}>
                <div className={`h-14 rounded-input border border-border ${cls}`} />
                <p className="mt-2 text-body font-semibold">{name}</p>
                <p className="text-overline text-slate">{hint}</p>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Type scale · Inter" />
          <CardBody className="divide-y divide-border">
            <p className="pb-3 text-page font-bold tracking-[-0.01em]">Page title</p>
            <p className="py-3 text-section font-semibold">Section heading</p>
            <p className="py-3 text-card font-semibold">Card title</p>
            <p className="py-3 text-body">Body and table text</p>
            <p className="py-3 text-helper text-slate">Secondary, helper text</p>
            <p className="eyebrow py-3 text-slate">Table header</p>
            <p className="pt-3 text-kpi font-bold tabular">₹ 2,48,560</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Buttons" />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button>Save customer</Button>
              <Button variant="accent">Charge ₹4,718</Button>
              <Button variant="outline">Export</Button>
              <Button variant="ghost">Cancel</Button>
              <Button variant="danger">Delete</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small · 32</Button>
              <Button>Default · 40</Button>
              <Button size="lg">Large · 48</Button>
              <Button disabled>Disabled</Button>
              <Button loading loadingText="Saving…">
                Save
              </Button>
              <Menu
                items={[
                  { label: "View invoice", onSelect: () => {} },
                  { label: "Print", onSelect: () => {} },
                  { label: "Send on WhatsApp", onSelect: () => {} },
                  { label: "Cancel invoice", destructive: true, onSelect: () => setConfirm(true) },
                ]}
                trigger={(p) => (
                  <Button variant="outline" {...p} aria-label="More">
                    ⋯
                  </Button>
                )}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="success">Paid</Badge>
              <Badge tone="warning">Partially paid</Badge>
              <Badge tone="danger">Overdue</Badge>
              <Badge>Draft</Badge>
              <Badge tone="info">In service</Badge>
              <Badge tone="ready">Ready for delivery</Badge>
              <Badge tone="highlight">Low stock</Badge>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Form fields" />
          <CardBody>
            <FormGrid>
              <Field label="Customer name" required>
                {(p) => <Input {...p} defaultValue="Rakesh Menon" />}
              </Field>
              <Field label="Vehicle number" helper="Focus state · navy ring">
                {(p) => <Input {...p} defaultValue="KL 07 CB 4412" />}
              </Field>
              <Field label="Phone" error="Enter a 10-digit mobile number">
                {(p) => <Input {...p} defaultValue="98470 1" />}
              </Field>
              <Field label="Customer type">
                {(p) => (
                  <Select {...p}>
                    <option>Retail</option>
                    <option>Fleet</option>
                  </Select>
                )}
              </Field>
              <Field label="Odometer">{(p) => <Input {...p} defaultValue="48,215" align="right" suffix="km" />}</Field>
              <div className="flex flex-col gap-1.5">
                <span className="text-body font-medium">Fuel level</span>
                <SegmentedControl
                  label="Fuel level"
                  value={fuel}
                  onChange={setFuel}
                  options={["E", "¼", "½", "¾", "F"].map((v) => ({ value: v, label: v }))}
                />
              </div>
            </FormGrid>
            <div className="mt-5 flex flex-wrap gap-2">
              {["Periodic service", "Brakes", "AC", "Electrical", "Suspension"].map((c) => (
                <Chip
                  key={c}
                  selected={chips.has(c)}
                  onClick={() =>
                    setChips((s) => {
                      const n = new Set(s);
                      if (n.has(c)) n.delete(c);
                      else n.add(c);
                      return n;
                    })
                  }
                >
                  {c}
                </Chip>
              ))}
            </div>
          </CardBody>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <KpiCard
            label="Today's sales"
            value="₹48,320"
            sub="37 bills · avg ₹1,306"
            badge={
              <Badge tone="success" dot={false}>
                +12%
              </Badge>
            }
          />
          <KpiCard
            label="Receivables"
            value="₹2,48,560"
            sub="₹62,100 overdue > 30 days"
            badge={
              <Badge tone="highlight" dot={false}>
                11 parties
              </Badge>
            }
          />
          <div className="sm:col-span-2">
            <SegmentedControl
              label="Range"
              value={range}
              onChange={setRange}
              options={[
                { value: "today", label: "Today" },
                { value: "7d", label: "7 days" },
                { value: "30d", label: "30 days" },
              ]}
            />
          </div>
        </div>

        <Card>
          <CardHeader title="Toast & modal" />
          <CardBody className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() =>
                toast({ message: "Invoice INV-24-01874 saved", action: { label: "Print", onClick: () => {} } })
              }
            >
              Show toast
            </Button>
            <Button variant="danger-outline" onClick={() => setConfirm(true)}>
              Open confirm
            </Button>
            <span className="inline-flex items-center gap-2 text-helper text-slate">
              <Loader2 className="size-4 animate-spin" /> Spinners only inside buttons
            </span>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Empty state · first use" />
          <EmptyState
            icon={FileText}
            title="No invoices yet"
            description="Charge your first bill at the POS. Invoices, payments and returns collect here."
            action={<Button>New bill</Button>}
          />
        </Card>
        <Card>
          <CardHeader title="Loading · table skeleton" />
          <TableSkeleton rows={5} />
        </Card>
        <Card>
          <CardHeader title="Error · failed to load" />
          <CardBody className="space-y-4">
            <ErrorBanner
              title="Couldn't load stock levels"
              message="The server didn't respond. Your last sync was at 10:42. Check the connection and try again."
              onRetry={() => {}}
              extra={
                <Button size="sm" variant="danger-outline">
                  View cached data
                </Button>
              }
            />
            <NoResults
              query="brake pad swift 2019"
              hint="Try the OEM part number, or clear the brand filter."
              onClear={() => {}}
            />
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={confirm}
        title="Cancel invoice INV-24-01873?"
        body="Stock for 3 items will be returned to inventory. This can't be undone."
        cancelLabel="Keep invoice"
        confirmLabel="Cancel invoice"
        onConfirm={() => setConfirm(false)}
        onClose={() => setConfirm(false)}
      />
    </>
  );
}
