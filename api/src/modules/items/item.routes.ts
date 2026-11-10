import { Router } from "express";
import { container } from "../../config/inversify.config";
import { TYPES } from "../../config/ioc.types";
import { idParamSchema } from "../../common/schemas";
import type { AuthMiddleware } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import type { ItemController } from "./item.controller";
import {
  codeParamSchema,
  createItemSchema,
  listItemsQuerySchema,
  searchItemsQuerySchema,
  updateItemSchema,
} from "./item.schema";

const controller = container.get<ItemController>(TYPES.ItemController);
const { requireAuth, requirePermission, optionalBranch } = container.get<AuthMiddleware>(TYPES.AuthMiddleware);
// The POS looks parts up too.
const view = requirePermission("inventory.view", "inventory.manage", "pos.use");
const manage = requirePermission("inventory.manage");

export const itemsRouter = Router();

itemsRouter.use(requireAuth, optionalBranch);

// Fixed paths before /:id.
itemsRouter.get("/search", view, validate({ query: searchItemsQuerySchema }), controller.search);
itemsRouter.get("/by-barcode/:code", view, validate({ params: codeParamSchema }), controller.byCode);
itemsRouter.get("/", view, validate({ query: listItemsQuerySchema }), controller.list);
itemsRouter.get("/:id", view, validate({ params: idParamSchema }), controller.getById);

itemsRouter.post("/", manage, validate({ body: createItemSchema }), controller.create);
itemsRouter.patch("/:id", manage, validate({ params: idParamSchema, body: updateItemSchema }), controller.update);
itemsRouter.delete("/:id", manage, validate({ params: idParamSchema }), controller.remove);
