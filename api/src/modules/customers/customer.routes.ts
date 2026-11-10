import { Router } from "express";
import { container } from "../../config/inversify.config";
import { TYPES } from "../../config/ioc.types";
import { idParamSchema } from "../../common/schemas";
import type { AuthMiddleware } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import type { CustomerController } from "./customer.controller";
import {
  createCustomerSchema,
  listCustomersQuerySchema,
  lookupCustomerQuerySchema,
  updateCustomerSchema,
} from "./customer.schema";

const controller = container.get<CustomerController>(TYPES.CustomerController);
const { requireAuth, requirePermission } = container.get<AuthMiddleware>(TYPES.AuthMiddleware);
const view = requirePermission("customer.view", "customer.manage");
const manage = requirePermission("customer.manage");

export const customersRouter = Router();

customersRouter.use(requireAuth);

// /lookup must be registered before /:id
customersRouter.get("/lookup", view, validate({ query: lookupCustomerQuerySchema }), controller.lookup);
customersRouter.get("/", view, validate({ query: listCustomersQuerySchema }), controller.list);
customersRouter.get("/:id", view, validate({ params: idParamSchema }), controller.getById);

customersRouter.post("/", manage, validate({ body: createCustomerSchema }), controller.create);
customersRouter.patch(
  "/:id",
  manage,
  validate({ params: idParamSchema, body: updateCustomerSchema }),
  controller.update,
);
customersRouter.delete("/:id", manage, validate({ params: idParamSchema }), controller.remove);
