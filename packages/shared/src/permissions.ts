// Permission catalog. Roles store a list of these codes; the API checks them with
// requirePermission() and the UI uses them to show or hide menus and actions.

export const PERMISSION_GROUPS = [
  {
    group: "Sales",
    permissions: [
      { code: "dashboard.view", label: "View dashboard" },
      { code: "pos.use", label: "Use POS billing" },
      { code: "invoice.view", label: "View invoices" },
      { code: "invoice.create", label: "Create invoices and record payments" },
      { code: "invoice.cancel", label: "Cancel invoices / issue credit notes" },
      { code: "discount.override", label: "Approve discounts above the limit" },
      { code: "credit.override", label: "Allow dues above the customer's limit" },
      { code: "customer.view", label: "View customers" },
      { code: "customer.manage", label: "Create and edit customers" },
      { code: "dues.opening", label: "Enter customers' old dues (opening balance)" },
    ],
  },
  {
    group: "Vehicles",
    permissions: [
      { code: "vehicle.view", label: "View vehicle makes and models" },
      { code: "vehicle.manage", label: "Edit vehicle makes and models" },
    ],
  },
  {
    group: "Stock",
    permissions: [
      { code: "inventory.view", label: "View inventory" },
      { code: "inventory.manage", label: "Manage items, stock adjustments and transfers" },
      { code: "stock.approve", label: "Approve stock adjustments above the limit" },
    ],
  },
  {
    group: "Admin",
    permissions: [
      { code: "report.view", label: "View reports" },
      { code: "settings.manage", label: "Manage business settings and number series" },
      { code: "branch.manage", label: "Manage branches" },
      { code: "user.manage", label: "Manage users" },
      { code: "role.manage", label: "Manage roles and permissions" },
      { code: "audit.view", label: "View audit log" },
    ],
  },
] as const;

export type Permission = (typeof PERMISSION_GROUPS)[number]["permissions"][number]["code"];

export const PERMISSIONS: readonly Permission[] = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.code));

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

// System roles seeded on a fresh install. OWNER bypasses permission and branch checks.
export const SYSTEM_ROLE_KEYS = ["OWNER", "BRANCH_MANAGER", "COUNTER", "STOREKEEPER", "ACCOUNTANT"] as const;

export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

export const SYSTEM_ROLES: Record<SystemRoleKey, { name: string; description: string; permissions: Permission[] }> = {
  OWNER: {
    name: "Owner",
    description: "Full access to every branch, settings and reports.",
    permissions: [...PERMISSIONS],
  },
  BRANCH_MANAGER: {
    name: "Branch manager",
    description: "Runs a branch; approves cancellations, discounts and stock adjustments.",
    permissions: [
      "dashboard.view",
      "pos.use",
      "invoice.view",
      "invoice.create",
      "invoice.cancel",
      "discount.override",
      "credit.override",
      "customer.view",
      "customer.manage",
      "dues.opening",
      "vehicle.view",
      "vehicle.manage",
      "inventory.view",
      "inventory.manage",
      "stock.approve",
      "report.view",
      "audit.view",
    ],
  },
  COUNTER: {
    name: "Counter",
    description: "Cashier: POS billing, invoices, customers and shifts.",
    permissions: [
      "dashboard.view",
      "pos.use",
      "invoice.view",
      "invoice.create",
      "customer.view",
      "customer.manage",
      "vehicle.view",
      "inventory.view",
    ],
  },
  STOREKEEPER: {
    name: "Storekeeper",
    description: "Items, stock adjustments and transfers.",
    permissions: ["inventory.view", "inventory.manage"],
  },
  ACCOUNTANT: {
    name: "Accountant",
    description: "Invoices, payments, customers' dues and GST reports.",
    permissions: ["dashboard.view", "invoice.view", "invoice.create", "customer.view", "report.view"],
  },
};
