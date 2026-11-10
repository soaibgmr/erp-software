import { inject, injectable } from "inversify";
import type { Request, Response } from "express";
import { TYPES } from "../../config/ioc.types";
import { sendCreated, sendPaginated, sendSuccess } from "../../common/api-response";
import type { IAccountService } from "./interfaces/iaccount.service";
import type { IUserService } from "./interfaces/iuser.service";

// Handlers are arrow properties so they can be passed to the router without binding.
// Inputs come from res.locals, populated by the validate() and requireAuth middleware.
@injectable()
export class UserController {
  constructor(
    @inject(TYPES.UserService) private readonly userService: IUserService,
    @inject(TYPES.AccountService) private readonly accounts: IAccountService,
  ) {}

  register = async (req: Request, res: Response) => {
    sendCreated(
      res,
      await this.accounts.register(res.locals.body, req.ip),
      "Thank you! Your shop is waiting for approval. We'll email you once it is active.",
    );
  };

  forgotPassword = async (_req: Request, res: Response) => {
    await this.accounts.forgotPassword(res.locals.body.identifier);
    sendSuccess(res, null, {
      message: "If this account has an email address, we have sent a link to reset the password.",
    });
  };

  resetPassword = async (_req: Request, res: Response) => {
    await this.accounts.resetPassword(res.locals.body.token, res.locals.body.password);
    sendSuccess(res, null, { message: "Password changed. You can log in now." });
  };

  verifyEmail = async (_req: Request, res: Response) => {
    await this.accounts.verifyEmail(res.locals.body.token);
    sendSuccess(res, null, { message: "Email confirmed" });
  };

  login = async (req: Request, res: Response) => {
    sendSuccess(res, await this.userService.login(res.locals.body, req.ip), { message: "Logged in successfully" });
  };

  refresh = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.userService.refresh(res.locals.body.refreshToken), { message: "Token refreshed" });
  };

  logout = async (_req: Request, res: Response) => {
    await this.userService.logout(res.locals.body.refreshToken);
    sendSuccess(res, null, { message: "Logged out successfully" });
  };

  changePassword = async (_req: Request, res: Response) => {
    await this.userService.changePassword(res.locals.auth, res.locals.body);
    sendSuccess(res, null, { message: "Password changed" });
  };

  getMe = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.userService.getMe(res.locals.auth));
  };

  updateMe = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.userService.updateMe(res.locals.auth, res.locals.body), { message: "Profile updated" });
  };

  create = async (_req: Request, res: Response) => {
    sendCreated(res, await this.userService.create(res.locals.auth, res.locals.body), "User created");
  };

  list = async (_req: Request, res: Response) => {
    sendPaginated(res, await this.userService.list(res.locals.auth, res.locals.query));
  };

  getById = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.userService.getById(res.locals.auth.businessId, res.locals.params.id));
  };

  update = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.userService.update(res.locals.auth, res.locals.params.id, res.locals.body), {
      message: "User updated",
    });
  };

  setPassword = async (_req: Request, res: Response) => {
    await this.userService.setPassword(res.locals.auth, res.locals.params.id, res.locals.body.password);
    sendSuccess(res, null, { message: "Password changed" });
  };

  // 200 with a body instead of 204 so every response shares the same envelope.
  remove = async (_req: Request, res: Response) => {
    await this.userService.remove(res.locals.auth, res.locals.params.id);
    sendSuccess(res, null, { message: "User deleted" });
  };
}
