import { Router } from "express";
import { container } from "../../config/inversify.config";
import { TYPES } from "../../config/ioc.types";
import { idParamSchema } from "../../common/schemas";
import type { AuthMiddleware } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import type { UserController } from "./user.controller";
import {
  changePasswordSchema,
  createUserSchema,
  listUsersQuerySchema,
  loginSchema,
  refreshSchema,
  updateMeSchema,
  updateUserSchema,
} from "./user.schema";

const controller = container.get<UserController>(TYPES.UserController);
const { requireAuth, requirePermission } = container.get<AuthMiddleware>(TYPES.AuthMiddleware);

// No public registration: accounts are created by a user with `user.manage`.
export const authRouter = Router();

authRouter.post("/login", validate({ body: loginSchema }), controller.login);
authRouter.post("/refresh", validate({ body: refreshSchema }), controller.refresh);
authRouter.post("/logout", validate({ body: refreshSchema }), controller.logout);

export const usersRouter = Router();

usersRouter.use(requireAuth);

// /me must be registered before /:id
usersRouter.get("/me", controller.getMe);
usersRouter.patch("/me", validate({ body: updateMeSchema }), controller.updateMe);
usersRouter.patch("/me/password", validate({ body: changePasswordSchema }), controller.changePassword);

usersRouter.use(requirePermission("user.manage"));

usersRouter.post("/", validate({ body: createUserSchema }), controller.create);
usersRouter.get("/", validate({ query: listUsersQuerySchema }), controller.list);
usersRouter.get("/:id", validate({ params: idParamSchema }), controller.getById);
usersRouter.patch("/:id", validate({ params: idParamSchema, body: updateUserSchema }), controller.update);
usersRouter.delete("/:id", validate({ params: idParamSchema }), controller.remove);
