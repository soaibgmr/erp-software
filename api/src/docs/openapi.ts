import { CLIENT_ID_HEADER } from "../middleware/client-id";
import { auditPaths, auditSchemas } from "../modules/audit/audit.docs";
import { branchPaths, branchSchemas } from "../modules/branches/branch.docs";
import { catalogPaths, catalogSchemas } from "../modules/catalog/catalog.docs";
import { businessPaths, businessSchemas } from "../modules/business/business.docs";
import { customerPaths, customerSchemas } from "../modules/customers/customer.docs";
import { documentSequencePaths, documentSequenceSchemas } from "../modules/document-sequences/document-sequence.docs";
import { healthPaths } from "../modules/health/health.docs";
import { salesPaths, salesSchemas } from "../modules/invoices/invoice.docs";
import { itemPaths, itemSchemas } from "../modules/items/item.docs";
import { labourServicePaths, labourServiceSchemas } from "../modules/labour-services/labour-service.docs";
import { rolePaths, roleSchemas } from "../modules/roles/role.docs";
import { settingsPaths, settingsSchemas } from "../modules/settings/settings.docs";
import { stockPaths, stockSchemas } from "../modules/stock/stock.docs";
import { dashboardPaths, dashboardSchemas } from "../modules/dashboard/dashboard.docs";
import { reportPaths, reportSchemas } from "../modules/reports/report.docs";
import { userPaths, userSchemas } from "../modules/users/user.docs";
import { ref } from "./openapi.helpers";

// OpenAPI 3.1 document served by Swagger UI at /docs. Each module owns a `<module>.docs.ts`
// exporting its paths (and response schemas); add new modules here alongside index.routes.ts.

const errorResponse = (description: string, code: string) => ({
  description,
  content: {
    "application/json": {
      schema: ref("ErrorResponse"),
      example: { success: false, error: { code, message: description } },
    },
  },
});

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "ERP Software API",
    version: "0.1.0",
    description:
      "Every `/api/v1` route (except health) requires the `clientid` header when `CLIENT_ID` is set. " +
      "Click **Authorize**, enter the client id, then call `POST /api/v1/auth/login` and paste the returned `token` into `bearerAuth`. " +
      "Permissions come from the user's role; the Owner role passes every check.",
  },
  servers: [{ url: "/" }],
  tags: [
    { name: "Health" },
    { name: "Auth", description: "Login and refresh-token rotation." },
    { name: "Users - Me", description: "The authenticated user's own account, permissions and branches." },
    { name: "Users", description: "User management (`user.manage`)." },
    { name: "Roles", description: "Roles and the permission catalog." },
    { name: "Business", description: "Business profile printed on invoices." },
    { name: "Branches" },
    { name: "Settings", description: "Tax, print and POS settings." },
    { name: "Number series", description: "Invoice, credit note, stock and purchase document numbering per branch and financial year." },
    { name: "Customers" },
    { name: "Audit" },
    { name: "Catalog", description: "Item categories, brands, HSN/SAC codes, vehicle makes and models." },
    { name: "Items", description: "Part master and the POS part search." },
    { name: "Labour services" },
    { name: "Shifts", description: "Counter sessions: opening cash, counted vs expected at close." },
    { name: "POS", description: "Cart pricing and held carts." },
    { name: "Invoices", description: "Charge, payments, cancellation and credit notes." },
    { name: "Dashboard", description: "KPI cards, sales trend and low stock for a branch or all branches." },
    { name: "Reports", description: "Sales, GST and stock reports as JSON, CSV or Excel; GSTR-1 portal JSON; Tally XML." },
    { name: "Stock", description: "Levels, ledger, adjustments, transfers and import. All stock changes go through the append-only ledger." },
  ],
  paths: {
    ...healthPaths,
    ...userPaths,
    ...rolePaths,
    ...businessPaths,
    ...branchPaths,
    ...settingsPaths,
    ...documentSequencePaths,
    ...customerPaths,
    ...auditPaths,
    ...catalogPaths,
    ...itemPaths,
    ...labourServicePaths,
    ...stockPaths,
    ...salesPaths,
    ...dashboardPaths,
    ...reportPaths,
  },
  components: {
    securitySchemes: {
      clientId: { type: "apiKey", in: "header", name: CLIENT_ID_HEADER },
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        required: ["success", "error"],
        properties: {
          success: { const: false },
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: { description: "Validation errors (zod flattenError) for 400 responses." },
            },
          },
        },
      },
      PaginationMeta: {
        type: "object",
        required: ["page", "limit", "total", "totalPages"],
        properties: {
          page: { type: "integer" },
          limit: { type: "integer" },
          total: { type: "integer" },
          totalPages: { type: "integer" },
        },
      },
      ...userSchemas,
      ...roleSchemas,
      ...businessSchemas,
      ...branchSchemas,
      ...settingsSchemas,
      ...documentSequenceSchemas,
      ...customerSchemas,
      ...auditSchemas,
      ...catalogSchemas,
      ...itemSchemas,
      ...labourServiceSchemas,
      ...stockSchemas,
      ...salesSchemas,
      ...dashboardSchemas,
      ...reportSchemas,
    },
    responses: {
      ServiceUnavailable: errorResponse("Database is down", "DB_UNAVAILABLE"),
    },
  },
};
