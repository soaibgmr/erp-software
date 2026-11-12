import { createBrowserRouter, Navigate, Outlet, useLocation } from "react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "./auth";
import { AppShell } from "./AppShell";
import { RouteError } from "./RouteError";
import { ALL_NAV_ITEMS } from "./nav";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/States";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage } from "@/features/auth/PasswordPages";
import { PlatformShell, PlatformShopsPage } from "@/features/platform/PlatformPages";
import { PlatformDemoRequestsPage } from "@/features/platform/DemoRequestsPage";
import { PhoneScanPage } from "@/features/pos-scanner/PhoneScanPage";
import { CustomersPage } from "@/features/customers/CustomersPage";
import { CustomerFormPage } from "@/features/customers/CustomerFormPage";
import { CustomerDetailPage } from "@/features/customers/CustomerDetailPage";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { ReportViewerPage } from "@/features/reports/ReportViewerPage";
import { ComponentGallery } from "@/features/dev/ComponentGallery";
import { ComingSoonPage, NotFoundPage } from "@/features/home/ComingSoonPage";
import { DashboardPage } from "@/features/home/DashboardPage";
import { LandingPage } from "@/features/home/LandingPage";
import { HelpPage } from "@/features/help/HelpPage";
import { AdjustmentDetailPage } from "@/features/inventory/pages/AdjustmentDetailPage";
import { AdjustmentFormPage } from "@/features/inventory/pages/AdjustmentFormPage";
import { AdjustmentsPage } from "@/features/inventory/pages/AdjustmentsPage";
import { ImportPage } from "@/features/inventory/pages/ImportPage";
import { ItemDetailPage } from "@/features/inventory/pages/ItemDetailPage";
import { ItemFormPage } from "@/features/inventory/pages/ItemFormPage";
import { LabelsPrintPage } from "@/features/inventory/pages/LabelsPrintPage";
import { LabourServicesPage } from "@/features/inventory/pages/LabourServicesPage";
import { MastersPage } from "@/features/inventory/pages/MastersPage";
import { StockPage } from "@/features/inventory/pages/StockPage";
import { TransferDetailPage } from "@/features/inventory/pages/TransferDetailPage";
import { TransferFormPage } from "@/features/inventory/pages/TransferFormPage";
import { TransfersPage } from "@/features/inventory/pages/TransfersPage";
import { CreditNoteDetailPage } from "@/features/invoices/pages/CreditNoteDetailPage";
import { CreditNoteFormPage } from "@/features/invoices/pages/CreditNoteFormPage";
import { CreditNotesPage } from "@/features/invoices/pages/CreditNotesPage";
import { InvoiceDetailPage } from "@/features/invoices/pages/InvoiceDetailPage";
import { InvoicesPage } from "@/features/invoices/pages/InvoicesPage";
import { ShiftReportPage } from "@/features/invoices/pages/ShiftReportPage";
import { ShiftsPage } from "@/features/invoices/pages/ShiftsPage";
import { PosPage } from "@/features/pos/PosPage";
import { CreditNotePrintPage } from "@/features/print/CreditNotePrintPage";
import { InvoicePrintPage } from "@/features/print/InvoicePrintPage";
import { ProfilePage } from "@/features/home/ProfilePage";
import { AuditLogPage } from "@/features/settings/AuditLogPage";
import { BillingSettingsPage } from "@/features/settings/BillingSettingsPage";
import { BranchesPage } from "@/features/settings/BranchesPage";
import { BusinessPage } from "@/features/settings/BusinessPage";
import { NumberSeriesPage } from "@/features/settings/NumberSeriesPage";
import { RolesPage } from "@/features/settings/RolesPage";
import { RequirePermission, SettingsLayout } from "@/features/settings/SettingsLayout";
import { UsersPage } from "@/features/settings/UsersPage";
import { errorMessage } from "@/lib/utils";
import type { Permission } from "@erp-software/shared";

function RequireAuth() {
  const { status, error, logout } = useAuth();
  const location = useLocation();
  // Visitors who aren't signed in see the public landing page at "/"; any other page asks them to log in.
  if (status === "signed-out" && location.pathname === "/") return <LandingPage />;
  if (status === "signed-out")
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate" role="status">
        <Loader2 className="size-6 animate-spin" aria-label="Loading" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto mt-24 max-w-md px-4">
        <ErrorBanner
          title="Couldn't load your account"
          message={errorMessage(error)}
          extra={
            <Button size="sm" variant="outline" onClick={() => void logout()}>
              Sign out
            </Button>
          }
        />
      </div>
    );
  }
  return <Outlet />;
}

function Guard({ permissions, children }: { permissions: Permission[]; children: React.ReactNode }) {
  const { can } = useAuth();
  return can(...permissions) ? <>{children}</> : <Navigate to="/" replace />;
}

const inventoryView: Permission[] = ["inventory.view", "inventory.manage"];
const inventoryManage: Permission[] = ["inventory.manage"];
const invoiceView: Permission[] = ["invoice.view", "invoice.create"];
const shiftView: Permission[] = ["pos.use", "report.view"];
const guarded = (path: string, permissions: Permission[], element: React.ReactNode) => ({
  path,
  element: <Guard permissions={permissions}>{element}</Guard>,
});

const settingsTab = (path: string, permission: Permission, element: React.ReactNode) => ({
  path,
  element: <RequirePermission permission={permission}>{element}</RequirePermission>,
});

// Modules scheduled for later phases render a placeholder at their real URL.
const comingSoon = ALL_NAV_ITEMS.filter((i) => i.phase).map((i) => ({
  path: `${i.to.slice(1)}/*`,
  element: <ComingSoonPage />,
}));

export const router = createBrowserRouter([
  // One error screen for every page: a crash while rendering shows it instead of the router's default.
  {
    errorElement: <RouteError />,
    children: [
      // Public pages: log in, shop sign-up, password reset and the links from emails.
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      { path: "/forgot-password", element: <ForgotPasswordPage /> },
      { path: "/reset-password", element: <ResetPasswordPage /> },
      { path: "/verify-email", element: <VerifyEmailPage /> },
      // The phone side of "Scan with phone" on the POS: no login, the QR code's link carries a one-counter token.
      { path: "/scan/:sessionId", element: <PhoneScanPage /> },
      // The platform admin's console (approves shops). Signs in on /login; its token is kept apart from shop sessions.
      // One login page for shops and the platform admin; old links to /admin/login still work.
      { path: "/admin/login", element: <Navigate to="/login" replace /> },
      {
        path: "/admin",
        element: <PlatformShell />,
        children: [
          { index: true, element: <Navigate to="/admin/shops" replace /> },
          { path: "shops", element: <PlatformShopsPage /> },
          { path: "demo-requests", element: <PlatformDemoRequestsPage /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          // Print views render outside the app shell (no sidebar or top bar on paper).
          {
            path: "print/labels",
            element: (
              <Guard permissions={inventoryView}>
                <LabelsPrintPage />
              </Guard>
            ),
          },
          // ?format=a4 (default) | thermal
          {
            path: "print/invoice/:id",
            element: (
              <Guard permissions={invoiceView}>
                <InvoicePrintPage />
              </Guard>
            ),
          },
          {
            path: "print/credit-note/:id",
            element: (
              <Guard permissions={invoiceView}>
                <CreditNotePrintPage />
              </Guard>
            ),
          },
          // Full-screen POS with its own header (PRD M5.1).
          {
            path: "pos",
            element: (
              <Guard permissions={["pos.use"]}>
                <PosPage />
              </Guard>
            ),
          },
          {
            element: <AppShell />,
            children: [
              { index: true, element: <DashboardPage /> },
              {
                path: "customers",
                children: [
                  {
                    index: true,
                    element: (
                      <Guard permissions={["customer.view", "customer.manage"]}>
                        <CustomersPage />
                      </Guard>
                    ),
                  },
                  {
                    path: "new",
                    element: (
                      <Guard permissions={["customer.manage"]}>
                        <CustomerFormPage />
                      </Guard>
                    ),
                  },
                  {
                    path: ":id",
                    element: (
                      <Guard permissions={["customer.view", "customer.manage"]}>
                        <CustomerDetailPage />
                      </Guard>
                    ),
                  },
                  {
                    path: ":id/edit",
                    element: (
                      <Guard permissions={["customer.manage"]}>
                        <CustomerFormPage />
                      </Guard>
                    ),
                  },
                ],
              },
              {
                path: "inventory",
                children: [
                  {
                    index: true,
                    element: (
                      <Guard permissions={inventoryView}>
                        <StockPage />
                      </Guard>
                    ),
                  },
                  guarded("items/new", inventoryManage, <ItemFormPage />),
                  guarded("items/:id", inventoryView, <ItemDetailPage />),
                  guarded("items/:id/edit", inventoryManage, <ItemFormPage />),
                  guarded("import", inventoryManage, <ImportPage />),
                  guarded("adjustments", inventoryView, <AdjustmentsPage />),
                  guarded("adjustments/new", inventoryManage, <AdjustmentFormPage />),
                  guarded("adjustments/:id", inventoryView, <AdjustmentDetailPage />),
                  guarded("transfers", inventoryView, <TransfersPage />),
                  guarded("transfers/new", inventoryManage, <TransferFormPage />),
                  guarded("transfers/:id", inventoryView, <TransferDetailPage />),
                  guarded("labour", inventoryView, <LabourServicesPage />),
                  guarded("masters", inventoryManage, <MastersPage />),
                ],
              },
              {
                path: "invoices",
                children: [
                  {
                    index: true,
                    element: (
                      <Guard permissions={invoiceView}>
                        <InvoicesPage />
                      </Guard>
                    ),
                  },
                  guarded("credit-notes", invoiceView, <CreditNotesPage />),
                  guarded("credit-notes/:id", invoiceView, <CreditNoteDetailPage />),
                  guarded("shifts", shiftView, <ShiftsPage />),
                  guarded("shifts/:id", shiftView, <ShiftReportPage />),
                  guarded(":id", invoiceView, <InvoiceDetailPage />),
                  guarded(":id/credit-note", ["invoice.cancel"], <CreditNoteFormPage />),
                ],
              },
              {
                path: "reports",
                children: [
                  {
                    index: true,
                    element: (
                      <Guard permissions={["report.view"]}>
                        <ReportsPage />
                      </Guard>
                    ),
                  },
                  guarded(":name", ["report.view"], <ReportViewerPage />),
                ],
              },
              {
                path: "settings",
                element: <SettingsLayout />,
                children: [
                  settingsTab("business", "settings.manage", <BusinessPage />),
                  settingsTab("branches", "branch.manage", <BranchesPage />),
                  settingsTab("users", "user.manage", <UsersPage />),
                  settingsTab("roles", "role.manage", <RolesPage />),
                  settingsTab("number-series", "settings.manage", <NumberSeriesPage />),
                  settingsTab("billing", "settings.manage", <BillingSettingsPage />),
                  settingsTab("audit", "audit.view", <AuditLogPage />),
                ],
              },
              { path: "profile", element: <ProfilePage /> },
              { path: "help", element: <HelpPage /> },
              { path: "dev/components", element: <ComponentGallery /> },
              ...comingSoon,
              { path: "*", element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
