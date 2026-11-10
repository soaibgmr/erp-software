import type { AuthContext } from "../../../common/auth-context";
import type { Paginated } from "../../../common/pagination";
import type {
  CreateItemDto,
  ItemDetailDto,
  ItemResponseDto,
  ItemSearchResultDto,
  ListItemsQuery,
  UpdateItemDto,
} from "../item.types";

export interface IItemService {
  list(query: ListItemsQuery, branchId?: string): Promise<Paginated<ItemResponseDto>>;
  search(term: string, limit: number, branchId?: string): Promise<ItemSearchResultDto[]>;
  getByCode(code: string, branchId?: string): Promise<ItemSearchResultDto>;
  getById(auth: AuthContext, id: string, branchId?: string): Promise<ItemDetailDto>;
  create(auth: AuthContext, input: CreateItemDto, branchId?: string): Promise<ItemDetailDto>;
  update(auth: AuthContext, id: string, input: UpdateItemDto, branchId?: string): Promise<ItemDetailDto>;
  remove(auth: AuthContext, id: string): Promise<void>;
}
