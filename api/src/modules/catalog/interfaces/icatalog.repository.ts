import type { CatalogDto, CatalogInput, CatalogKind, ListCatalogQuery } from "../catalog.types";

export interface ICatalogRepository {
  list(kind: CatalogKind, query: ListCatalogQuery): Promise<CatalogDto[]>;
  findById(kind: CatalogKind, id: string): Promise<CatalogDto | null>;
  // Active row with the same name (or code for HSN/SAC), case-insensitive; models are scoped to their make.
  findByKey(
    kind: CatalogKind,
    key: string,
    scope: { makeId?: string },
    excludeId?: string,
  ): Promise<{ id: string } | null>;
  create(kind: CatalogKind, data: CatalogInput): Promise<CatalogDto>;
  update(kind: CatalogKind, id: string, data: CatalogInput): Promise<CatalogDto | null>;
  softDelete(kind: CatalogKind, id: string): Promise<boolean>;
  // Number of active records that reference this row (items for a brand, models for a make…).
  usage(kind: CatalogKind, id: string): Promise<number>;
}
