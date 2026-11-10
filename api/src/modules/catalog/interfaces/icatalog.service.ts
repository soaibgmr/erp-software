import type { AuthContext } from "../../../common/auth-context";
import type { CatalogDto, CatalogInput, CatalogKind, ListCatalogQuery } from "../catalog.types";

export interface ICatalogService {
  list(kind: CatalogKind, query: ListCatalogQuery): Promise<CatalogDto[]>;
  getById(kind: CatalogKind, id: string): Promise<CatalogDto>;
  create(auth: AuthContext, kind: CatalogKind, input: CatalogInput): Promise<CatalogDto>;
  update(auth: AuthContext, kind: CatalogKind, id: string, input: CatalogInput): Promise<CatalogDto>;
  remove(auth: AuthContext, kind: CatalogKind, id: string): Promise<void>;
}
