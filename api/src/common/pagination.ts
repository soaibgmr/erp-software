export interface Paginated<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
