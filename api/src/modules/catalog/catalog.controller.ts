import { inject, injectable } from "inversify";
import type { RequestHandler } from "express";
import { TYPES } from "../../config/ioc.types";
import { sendCreated, sendSuccess } from "../../common/api-response";
import type { ICatalogService } from "./interfaces/icatalog.service";
import { CATALOG_LABELS, type CatalogKind } from "./catalog.types";

// One controller for every catalog master; the router binds each handler to a kind.
@injectable()
export class CatalogController {
  constructor(@inject(TYPES.CatalogService) private readonly catalog: ICatalogService) {}

  list =
    (kind: CatalogKind): RequestHandler =>
    async (_req, res) => {
      sendSuccess(res, await this.catalog.list(res.locals.auth, kind, res.locals.query));
    };

  getById =
    (kind: CatalogKind): RequestHandler =>
    async (_req, res) => {
      sendSuccess(res, await this.catalog.getById(res.locals.auth, kind, res.locals.params.id));
    };

  create =
    (kind: CatalogKind): RequestHandler =>
    async (_req, res) => {
      const row = await this.catalog.create(res.locals.auth, kind, res.locals.body);
      sendCreated(res, row, `${CATALOG_LABELS[kind].noun} created`);
    };

  update =
    (kind: CatalogKind): RequestHandler =>
    async (_req, res) => {
      const row = await this.catalog.update(res.locals.auth, kind, res.locals.params.id, res.locals.body);
      sendSuccess(res, row, { message: `${CATALOG_LABELS[kind].noun} updated` });
    };

  remove =
    (kind: CatalogKind): RequestHandler =>
    async (_req, res) => {
      await this.catalog.remove(res.locals.auth, kind, res.locals.params.id);
      sendSuccess(res, null, { message: `${CATALOG_LABELS[kind].noun} deleted` });
    };
}
