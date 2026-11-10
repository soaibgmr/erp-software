import type { CatalogDto, CatalogInput, CatalogKind, ListCatalogQuery } from "../catalog.types";

// Catalog masters belong to one business; every method is limited to it.
export interface ICatalogRepository {
  list(businessId: string, kind: CatalogKind, query: ListCatalogQuery): Promise<CatalogDto[]>;
  findById(businessId: string, kind: CatalogKind, id: string): Promise<CatalogDto | null>;
  // Active row with the same name (or code for HSN/SAC), case-insensitive; models are scoped to their make.
  findByKey(
    businessId: string,
    kind: CatalogKind,
    key: string,
    scope: { makeId?: string },
    excludeId?: string,
  ): Promise<{ id: string } | null>;
  create(businessId: string, kind: CatalogKind, data: CatalogInput): Promise<CatalogDto>;
  update(businessId: string, kind: CatalogKind, id: string, data: CatalogInput): Promise<CatalogDto | null>;
  softDelete(businessId: string, kind: CatalogKind, id: string): Promise<boolean>;
  // Number of active records that reference this row (items for a brand, models for a make…).
  usage(businessId: string, kind: CatalogKind, id: string): Promise<number>;
}
