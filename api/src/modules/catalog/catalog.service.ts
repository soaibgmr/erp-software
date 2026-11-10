import { inject, injectable } from "inversify";
import { TYPES } from "../../config/ioc.types";
import type { AuthContext } from "../../common/auth-context";
import { conflict, fieldErrors, notFound } from "../../common/http-error";
import type { IAuditService } from "../audit/interfaces/iaudit.service";
import type { ICatalogRepository } from "./interfaces/icatalog.repository";
import type { ICatalogService } from "./interfaces/icatalog.service";
import {
  CATALOG_LABELS,
  type CatalogDto,
  type CatalogInput,
  type CatalogKind,
  type ListCatalogQuery,
} from "./catalog.types";

@injectable()
export class CatalogService implements ICatalogService {
  constructor(
    @inject(TYPES.CatalogRepository) private readonly catalog: ICatalogRepository,
    @inject(TYPES.AuditService) private readonly audit: IAuditService,
  ) {}

  list(auth: AuthContext, kind: CatalogKind, query: ListCatalogQuery): Promise<CatalogDto[]> {
    return this.catalog.list(auth.businessId, kind, query);
  }

  async getById(auth: AuthContext, kind: CatalogKind, id: string): Promise<CatalogDto> {
    const row = await this.catalog.findById(auth.businessId, kind, id);
    if (!row) throw notFound(`${CATALOG_LABELS[kind].noun} not found`);
    return row;
  }

  async create(auth: AuthContext, kind: CatalogKind, input: CatalogInput): Promise<CatalogDto> {
    await this.assertValid(auth, kind, input);
    return this.catalog.create(auth.businessId, kind, input);
  }

  async update(auth: AuthContext, kind: CatalogKind, id: string, input: CatalogInput): Promise<CatalogDto> {
    const before = await this.getById(auth, kind, id);
    await this.assertValid(auth, kind, { ...before, ...stripUndefined(input) }, id);

    const after = await this.catalog.update(auth.businessId, kind, id, input);
    if (!after) throw notFound(`${CATALOG_LABELS[kind].noun} not found`);

    // An HSN code's GST rate feeds item defaults, so changes to it are audited.
    if (kind === "hsnSac") {
      await this.audit.record(auth, { action: "hsnSac.update", entity: "HsnSac", entityId: id, before, after });
    }
    return after;
  }

  async remove(auth: AuthContext, kind: CatalogKind, id: string): Promise<void> {
    const before = await this.getById(auth, kind, id);
    const { noun, entity } = CATALOG_LABELS[kind];
    const used = await this.catalog.usage(auth.businessId, kind, id);
    if (used > 0) {
      const what = kind === "vehicleMakes" ? "model" : "item";
      throw conflict(`${noun} is used by ${used} ${what}${used === 1 ? "" : "s"}. Move them first.`);
    }
    await this.catalog.softDelete(auth.businessId, kind, id);
    await this.audit.record(auth, { action: `${kind}.delete`, entity, entityId: id, before });
  }

  private async assertValid(auth: AuthContext, kind: CatalogKind, input: CatalogInput, excludeId?: string) {
    const keyField = CATALOG_LABELS[kind].key;
    const key = input[keyField] as string | undefined;
    const makeId = input.makeId as string | undefined;

    if (kind === "vehicleModels" && makeId && !(await this.catalog.findById(auth.businessId, "vehicleMakes", makeId))) {
      throw fieldErrors([{ path: "makeId", message: "Choose a make" }]);
    }
    if (key && (await this.catalog.findByKey(auth.businessId, kind, key, { makeId }, excludeId))) {
      throw fieldErrors([{ path: keyField, message: `${CATALOG_LABELS[kind].noun} ${key} already exists` }]);
    }
  }
}

const stripUndefined = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
