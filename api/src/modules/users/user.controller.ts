import { inject, injectable } from "inversify";
import type { Request, Response } from "express";
import { TYPES } from "../../config/ioc.types";
import { sendCreated, sendPaginated, sendSuccess } from "../../common/api-response";
import type { IUserService } from "./interfaces/iuser.service";

// Handlers are arrow properties so they can be passed to the router without binding.
// Inputs come from res.locals, populated by the validate() and requireAuth middleware.
@injectable()
export class UserController {
  constructor(@inject(TYPES.UserService) private readonly userService: IUserService) {}

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
    sendPaginated(res, await this.userService.list(res.locals.query));
  };

  getById = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.userService.getById(res.locals.params.id));
  };

  update = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.userService.update(res.locals.auth, res.locals.params.id, res.locals.body), {
      message: "User updated",
    });
  };

  // 200 with a body instead of 204 so every response shares the same envelope.
  remove = async (_req: Request, res: Response) => {
    await this.userService.remove(res.locals.auth, res.locals.params.id);
    sendSuccess(res, null, { message: "User deleted" });
  };
}
