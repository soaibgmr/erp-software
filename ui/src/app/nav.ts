import { BarChart3, FileText, LayoutGrid, Monitor, Package, Settings, Users, type LucideIcon } from "lucide-react";
import type { Permission } from "@automobile/shared";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  // Visible when the user has any of these (owners see everything).
  permissions?: Permission[];
  shortcut?: string;
  // Not built yet: the route shows a "coming in phase N" page.
  phase?: number;
  description?: string;
}

export const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Sales",
    items: [
      { label: "Dashboard", to: "/", icon: LayoutGrid, permissions: ["dashboard.view"] },
      {
        label: "POS billing",
        to: "/pos",
        icon: Monitor,
        permissions: ["pos.use"],
        shortcut: "F2",
      },
      {
        label: "Invoices",
        to: "/invoices",
        icon: FileText,
        permissions: ["invoice.view", "invoice.create"],
      },
      { label: "Customers", to: "/customers", icon: Users, permissions: ["customer.view", "customer.manage"] },
    ],
  },
  {
    section: "Stock",
    items: [
      {
        label: "Inventory",
        to: "/inventory",
        icon: Package,
        permissions: ["inventory.view", "inventory.manage"],
      },
    ],
  },
  {
    section: "Admin",
    items: [
      {
        label: "Reports",
        to: "/reports",
        icon: BarChart3,
        permissions: ["report.view"],
      },
      {
        label: "Settings",
        to: "/settings",
        icon: Settings,
        permissions: ["settings.manage", "branch.manage", "user.manage", "role.manage", "audit.view"],
      },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV.flatMap((s) => s.items);
