import { Router } from "express";
import { sendSuccess } from "../common/api-response";
import { isSwaggerEnabled } from "../config/env";
import { docsRouter } from "../docs/docs.routes";
import { verifyClientId } from "../middleware/client-id";
import { auditRouter } from "./audit/audit.routes";
import { branchesRouter } from "./branches/branch.routes";
import { businessRouter } from "./business/business.routes";
import {
  brandsRouter,
  hsnSacRouter,
  itemCategoriesRouter,
  vehicleMakesRouter,
  vehicleModelsRouter,
} from "./catalog/catalog.routes";
import { dashboardRouter } from "./dashboard/dashboard.routes";
import { reportsRouter } from "./reports/report.routes";
import { customersRouter } from "./customers/customer.routes";
import { documentSequencesRouter } from "./document-sequences/document-sequence.routes";
import { healthRouter } from "./health/health.routes";
import { creditNotesRouter, invoicesRouter, paymentsRouter } from "./invoices/invoice.routes";
import { itemsRouter } from "./items/item.routes";
import { labourServicesRouter } from "./labour-services/labour-service.routes";
import { permissionsRouter, rolesRouter } from "./roles/role.routes";
import { posRouter } from "./pos/pos.routes";
import { settingsRouter } from "./settings/settings.routes";
import { shiftsRouter } from "./shifts/shift.routes";
import { stockRouter } from "./stock/stock.routes";
import { authRouter, usersRouter } from "./users/user.routes";

// Every router in the app is mounted here. Add new modules to `apiRoutes`.

// Mounted at / — no clientid header required.
export const publicRoutes = Router();

publicRoutes.get("/", (req, res) => {
  sendSuccess(res, null, { message: "ERP Software API" });
});
if (isSwaggerEnabled) publicRoutes.use("/docs", docsRouter);

// Mounted at /api/v1 — every request must carry a valid clientid header,
// except health (load balancers, uptime checks), which is registered before the check.
export const apiRoutes = Router();

apiRoutes.use("/health", healthRouter);

apiRoutes.use(verifyClientId);

apiRoutes.use("/auth", authRouter);
apiRoutes.use("/users", usersRouter);
apiRoutes.use("/roles", rolesRouter);
apiRoutes.use("/permissions", permissionsRouter);
apiRoutes.use("/business", businessRouter);
apiRoutes.use("/branches", branchesRouter);
apiRoutes.use("/settings", settingsRouter);
apiRoutes.use("/document-sequences", documentSequencesRouter);
apiRoutes.use("/customers", customersRouter);
apiRoutes.use("/audit-logs", auditRouter);

// Phase 2: catalog, items and stock
apiRoutes.use("/item-categories", itemCategoriesRouter);
apiRoutes.use("/brands", brandsRouter);
apiRoutes.use("/hsn-sac", hsnSacRouter);
apiRoutes.use("/vehicle-makes", vehicleMakesRouter);
apiRoutes.use("/vehicle-models", vehicleModelsRouter);
apiRoutes.use("/items", itemsRouter);
apiRoutes.use("/labour-services", labourServicesRouter);
apiRoutes.use("/stock", stockRouter);

// Phase 3: POS billing and invoices
apiRoutes.use("/shifts", shiftsRouter);
apiRoutes.use("/pos", posRouter);
apiRoutes.use("/invoices", invoicesRouter);
apiRoutes.use("/payments", paymentsRouter);
apiRoutes.use("/credit-notes", creditNotesRouter);

// Phase 6: dashboard and reports
apiRoutes.use("/dashboard", dashboardRouter);
apiRoutes.use("/reports", reportsRouter);
