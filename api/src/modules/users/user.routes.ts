import { Router } from "express";
import { container } from "../../config/inversify.config";
import { TYPES } from "../../config/ioc.types";
import { idParamSchema } from "../../common/schemas";
import type { AuthMiddleware } from "../../middleware/auth";
import { rateLimit } from "../../middleware/rate-limit";
import type { IAttemptLimiter } from "../../common/attempt-limiter";
import { validate } from "../../middleware/validate";
import type { UserController } from "./user.controller";
import { forgotPasswordSchema, registerSchema, resetPasswordSchema, verifyEmailSchema } from "@erp-software/shared";
import {
  changePasswordSchema,
  createUserSchema,
  listUsersQuerySchema,
  loginSchema,
  refreshSchema,
  setPasswordSchema,
  updateMeSchema,
  updateUserSchema,
} from "./user.schema";

const controller = container.get<UserController>(TYPES.UserController);
const { requireAuth, requirePermission } = container.get<AuthMiddleware>(TYPES.AuthMiddleware);

// Public: shops register themselves (PENDING until the platform admin approves); staff accounts are
// created inside a shop by a user with `user.manage`.
export const authRouter = Router();

const MINUTE = 60_000;
const limiter = container.get<IAttemptLimiter>(TYPES.AttemptLimiter);
const loginLimit = rateLimit(limiter, { name: "login", windowMs: 15 * MINUTE, max: 20 });
const accountLimit = rateLimit(limiter, { name: "account", windowMs: 60 * MINUTE, max: 10 });
const refreshLimit = rateLimit(limiter, { name: "refresh", windowMs: 15 * MINUTE, max: 120 });

authRouter.post("/register", accountLimit, validate({ body: registerSchema }), controller.register);
authRouter.post("/login", loginLimit, validate({ body: loginSchema }), controller.login);
authRouter.post("/forgot-password", accountLimit, validate({ body: forgotPasswordSchema }), controller.forgotPassword);
authRouter.post("/reset-password", accountLimit, validate({ body: resetPasswordSchema }), controller.resetPassword);
authRouter.post("/verify-email", accountLimit, validate({ body: verifyEmailSchema }), controller.verifyEmail);
authRouter.post("/refresh", refreshLimit, validate({ body: refreshSchema }), controller.refresh);
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
usersRouter.post("/:id/password", validate({ params: idParamSchema, body: setPasswordSchema }), controller.setPassword);
usersRouter.delete("/:id", validate({ params: idParamSchema }), controller.remove);
