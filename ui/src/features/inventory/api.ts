import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { StockAdjustmentStatus, StockStatus, StockTransferStatus } from "@automobile/shared";
import { useAuth } from "@/app/auth";
import { api } from "@/lib/api-client";
import type {
  Brand,
  Category,
  HsnSac,
  ImportReport,
  ItemDetail,
  ItemSearchResult,
  ItemStock,
  LabourService,
  LedgerEntry,
  StockAdjustment,
  StockAdjustmentDetail,
  StockRow,
  StockTransfer,
  StockTransferDetail,
  VehicleMake,
  VehicleModel,
} from "@/lib/types";

// Stock data depends on the selected branch (sent as x-branch-id), so branch-scoped keys include it.
const useBranchId = () => useAuth().branch?.id ?? "none";

export const inventoryKeys = {
  all: ["inventory"] as const,
  stock: (branchId: string, f: object) => ["inventory", "stock", branchId, f] as const,
  item: (branchId: string, id: string) => ["inventory", "item", branchId, id] as const,
  ledger: (branchId: string, itemId: string, page: number) => ["inventory", "ledger", branchId, itemId, page] as const,
  search: (branchId: string, q: string) => ["inventory", "search", branchId, q] as const,
  adjustments: (branchId: string, f: object) => ["inventory", "adjustments", branchId, f] as const,
  adjustment: (id: string) => ["inventory", "adjustment", id] as const,
  transfers: (branchId: string, f: object) => ["inventory", "transfers", branchId, f] as const,
  transfer: (id: string) => ["inventory", "transfer", id] as const,
  labour: (f: object) => ["labour-services", f] as const,
  catalog: (resource: CatalogResource, f: object = {}) => ["catalog", resource, f] as const,
};

// ---------- Stock levels ----------

export interface StockFilters {
  page: number;
  search?: string;
  categoryId?: string;
  brandId?: string;
  status?: StockStatus;
  // "all" = every branch the user can access.
  branchId?: string;
  sort?: "name" | "sku" | "available";
}

export function useStock(filters: StockFilters) {
  const branchId = useBranchId();
  return useQuery({
    queryKey: inventoryKeys.stock(branchId, filters),
    queryFn: ({ signal }) => api.list<StockRow>("/stock", { ...filters, limit: 25 }, signal),
    placeholderData: keepPreviousData,
  });
}

export function useLedger(itemId: string | undefined, page: number) {
  const branchId = useBranchId();
  return useQuery({
    queryKey: inventoryKeys.ledger(branchId, itemId ?? "", page),
    queryFn: ({ signal }) => api.list<LedgerEntry>(`/stock/${itemId}/ledger`, { page, limit: 15 }, signal),
    enabled: Boolean(itemId),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateStockSettings(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.patch<ItemStock>(`/stock/${itemId}/settings`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: inventoryKeys.all }),
  });
}

// ---------- Items ----------

export function useItem(id: string | undefined) {
  const branchId = useBranchId();
  return useQuery({
    queryKey: inventoryKeys.item(branchId, id ?? ""),
    queryFn: ({ signal }) => api.get<ItemDetail>(`/items/${id}`, undefined, signal),
    enabled: Boolean(id),
  });
}

// Part picker for adjustment / transfer lines (and the POS).
export function useItemSearch(q: string) {
  const branchId = useBranchId();
  return useQuery({
    queryKey: inventoryKeys.search(branchId, q),
    queryFn: ({ signal }) => api.get<ItemSearchResult[]>("/items/search", { q, limit: 12 }, signal),
    enabled: q.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useSaveItem(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) =>
      id ? api.patch<ItemDetail>(`/items/${id}`, body) : api.post<ItemDetail>("/items", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: inventoryKeys.all }),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/items/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: inventoryKeys.all }),
  });
}

// ---------- Adjustments ----------

export function useAdjustments(filters: { page: number; status?: StockAdjustmentStatus }) {
  const branchId = useBranchId();
  return useQuery({
    queryKey: inventoryKeys.adjustments(branchId, filters),
    queryFn: ({ signal }) => api.list<StockAdjustment>("/stock/adjustments", { ...filters, limit: 20 }, signal),
    placeholderData: keepPreviousData,
  });
}

export function useAdjustment(id: string | undefined) {
  return useQuery({
    queryKey: inventoryKeys.adjustment(id ?? ""),
    queryFn: ({ signal }) => api.get<StockAdjustmentDetail>(`/stock/adjustments/${id}`, undefined, signal),
    enabled: Boolean(id),
  });
}

export function useCreateAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post<StockAdjustmentDetail>("/stock/adjustments", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: inventoryKeys.all }),
  });
}

export function useDecideAdjustment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, note }: { action: "approve" | "reject"; note?: string }) =>
      api.post<StockAdjustmentDetail>(
        `/stock/adjustments/${id}/${action}`,
        action === "reject" ? { note: note ?? "" } : {},
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: inventoryKeys.all }),
  });
}

// ---------- Transfers ----------

export function useTransfers(filters: { page: number; direction: "all" | "in" | "out"; status?: StockTransferStatus }) {
  const branchId = useBranchId();
  return useQuery({
    queryKey: inventoryKeys.transfers(branchId, filters),
    queryFn: ({ signal }) => api.list<StockTransfer>("/stock/transfers", { ...filters, limit: 20 }, signal),
    placeholderData: keepPreviousData,
  });
}

export function useTransfer(id: string | undefined) {
  return useQuery({
    queryKey: inventoryKeys.transfer(id ?? ""),
    queryFn: ({ signal }) => api.get<StockTransferDetail>(`/stock/transfers/${id}`, undefined, signal),
    enabled: Boolean(id),
  });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post<StockTransferDetail>("/stock/transfers", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: inventoryKeys.all }),
  });
}

export function useTransferAction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: "receive" | "cancel") => api.post<StockTransferDetail>(`/stock/transfers/${id}/${action}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: inventoryKeys.all }),
  });
}

// ---------- Import ----------

export function useStockImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { rows: Record<string, string>[]; commit: boolean; updateExisting: boolean }) =>
      api.post<ImportReport>("/stock/import", body),
    onSuccess: (report) => {
      if (report.committed) {
        qc.invalidateQueries({ queryKey: inventoryKeys.all });
        qc.invalidateQueries({ queryKey: ["catalog"] });
      }
    },
  });
}

// ---------- Labour services ----------

export function useLabourServices(filters: { page: number; search?: string; isActive?: boolean }) {
  return useQuery({
    queryKey: inventoryKeys.labour(filters),
    queryFn: ({ signal }) => api.list<LabourService>("/labour-services", { ...filters, limit: 20 }, signal),
    placeholderData: keepPreviousData,
  });
}

export function useSaveLabourService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: unknown }) =>
      id ? api.patch<LabourService>(`/labour-services/${id}`, body) : api.post<LabourService>("/labour-services", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["labour-services"] }),
  });
}

export function useDeleteLabourService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/labour-services/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["labour-services"] }),
  });
}

// ---------- Catalog masters ----------

export const CATALOG_PATHS = {
  categories: "/item-categories",
  brands: "/brands",
  hsnSac: "/hsn-sac",
  vehicleMakes: "/vehicle-makes",
  vehicleModels: "/vehicle-models",
} as const;
export type CatalogResource = keyof typeof CATALOG_PATHS;

interface CatalogTypes {
  categories: Category;
  brands: Brand;
  hsnSac: HsnSac;
  vehicleMakes: VehicleMake;
  vehicleModels: VehicleModel;
}

export function useCatalog<R extends CatalogResource>(resource: R, filters: { search?: string; makeId?: string } = {}) {
  return useQuery({
    queryKey: inventoryKeys.catalog(resource, filters),
    queryFn: ({ signal }) => api.get<CatalogTypes[R][]>(CATALOG_PATHS[resource], filters, signal),
    staleTime: 60_000,
  });
}

export function useSaveCatalog<R extends CatalogResource>(resource: R) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: unknown }) =>
      id
        ? api.patch<CatalogTypes[R]>(`${CATALOG_PATHS[resource]}/${id}`, body)
        : api.post<CatalogTypes[R]>(CATALOG_PATHS[resource], body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalog"] }),
  });
}

export function useDeleteCatalog(resource: CatalogResource) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`${CATALOG_PATHS[resource]}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalog"] }),
  });
}
