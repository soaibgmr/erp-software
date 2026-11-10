import { Router } from "express";
import type { Permission } from "@erp-software/shared";
import { container } from "../../config/inversify.config";
import { TYPES } from "../../config/ioc.types";
import { idParamSchema } from "../../common/schemas";
import type { AuthMiddleware } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import type { CatalogController } from "./catalog.controller";
import { CATALOG_SCHEMAS, listCatalogQuerySchema } from "./catalog.schema";
import type { CatalogKind } from "./catalog.types";

const controller = container.get<CatalogController>(TYPES.CatalogController);
const { requireAuth, requirePermission } = container.get<AuthMiddleware>(TYPES.AuthMiddleware);

// Reads are open to every signed-in user: item forms and POS filters need them.
function catalogRouter(kind: CatalogKind, managers: Permission[]) {
  const manage = requirePermission(...managers);
  const { create, update } = CATALOG_SCHEMAS[kind];
  const router = Router();
  router.use(requireAuth);
  router.get("/", validate({ query: listCatalogQuerySchema }), controller.list(kind));
  router.get("/:id", validate({ params: idParamSchema }), controller.getById(kind));
  router.post("/", manage, validate({ body: create }), controller.create(kind));
  router.patch("/:id", manage, validate({ params: idParamSchema, body: update }), controller.update(kind));
  router.delete("/:id", manage, validate({ params: idParamSchema }), controller.remove(kind));
  return router;
}

export const itemCategoriesRouter = catalogRouter("categories", ["inventory.manage"]);
export const brandsRouter = catalogRouter("brands", ["inventory.manage"]);
export const hsnSacRouter = catalogRouter("hsnSac", ["inventory.manage", "settings.manage"]);
export const vehicleMakesRouter = catalogRouter("vehicleMakes", ["inventory.manage", "vehicle.manage"]);
export const vehicleModelsRouter = catalogRouter("vehicleModels", ["inventory.manage", "vehicle.manage"]);
