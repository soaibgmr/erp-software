import { inject, injectable } from "inversify";
import type { Request, Response } from "express";
import { PERMISSION_GROUPS } from "@erp-software/shared";
import { TYPES } from "../../config/ioc.types";
import { sendCreated, sendSuccess } from "../../common/api-response";
import type { IRoleService } from "./interfaces/irole.service";

@injectable()
export class RoleController {
  constructor(@inject(TYPES.RoleService) private readonly roleService: IRoleService) {}

  permissions = async (_req: Request, res: Response) => {
    sendSuccess(res, PERMISSION_GROUPS);
  };

  list = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.roleService.list(res.locals.auth));
  };

  getById = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.roleService.getById(res.locals.auth, res.locals.params.id));
  };

  create = async (_req: Request, res: Response) => {
    sendCreated(res, await this.roleService.create(res.locals.auth, res.locals.body), "Role created");
  };

  update = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.roleService.update(res.locals.auth, res.locals.params.id, res.locals.body), {
      message: "Role updated",
    });
  };

  remove = async (_req: Request, res: Response) => {
    await this.roleService.remove(res.locals.auth, res.locals.params.id);
    sendSuccess(res, null, { message: "Role deleted" });
  };
}
