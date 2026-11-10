import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  DocumentType,
  InventorySettings,
  PosSettings,
  PrintSettings,
  SettingsGroup,
  TaxSettings,
  UserStatus,
} from "@erp-software/shared";
import { meKey } from "@/app/auth";
import { api } from "@/lib/api-client";
import type { AuditLog, Branch, Business, DocumentSequence, PermissionGroup, Role, User } from "@/lib/types";

export const keys = {
  business: ["business"] as const,
  branches: (includeInactive: boolean) => ["branches", { includeInactive }] as const,
  users: (f: object) => ["users", f] as const,
  roles: ["roles"] as const,
  permissions: ["permissions"] as const,
  sequences: (branchId: string) => ["document-sequences", branchId] as const,
  settings: ["settings"] as const,
  audit: (f: object) => ["audit-logs", f] as const,
};

// ---- Business ----
export const useBusiness = () =>
  useQuery({ queryKey: keys.business, queryFn: ({ signal }) => api.get<Business>("/business", undefined, signal) });

export function useUpdateBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.patch<Business>("/business", body),
    onSuccess: (b) => qc.setQueryData(keys.business, b),
  });
}

// ---- Branches ----
export const useBranches = (includeInactive = true) =>
  useQuery({
    queryKey: keys.branches(includeInactive),
    queryFn: ({ signal }) => api.get<Branch[]>("/branches", { includeInactive }, signal),
  });

export function useSaveBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: unknown }) =>
      id ? api.patch<Branch>(`/branches/${id}`, body) : api.post<Branch>("/branches", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] });
      qc.invalidateQueries({ queryKey: meKey });
    },
  });
}

export function useDeleteBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/branches/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] });
      qc.invalidateQueries({ queryKey: meKey });
    },
  });
}

// ---- Users ----
export interface UserFilters {
  page: number;
  search?: string;
  roleId?: string;
  status?: UserStatus;
}

export const useUsers = (f: UserFilters) =>
  useQuery({
    queryKey: keys.users(f),
    queryFn: ({ signal }) => api.list<User>("/users", { ...f, limit: 20 }, signal),
    placeholderData: keepPreviousData,
  });

export function useSaveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: unknown }) =>
      id ? api.patch<User>(`/users/${id}`, body) : api.post<User>("/users", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: keys.roles });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: keys.roles });
    },
  });
}

// ---- Roles ----
export const useRoles = (enabled = true) =>
  useQuery({ queryKey: keys.roles, queryFn: ({ signal }) => api.get<Role[]>("/roles", undefined, signal), enabled });

export const usePermissionGroups = () =>
  useQuery({
    queryKey: keys.permissions,
    queryFn: ({ signal }) => api.get<PermissionGroup[]>("/permissions", undefined, signal),
    staleTime: Infinity,
  });

export function useSaveRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: unknown }) =>
      id ? api.patch<Role>(`/roles/${id}`, body) : api.post<Role>("/roles", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.roles });
      qc.invalidateQueries({ queryKey: meKey });
    },
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/roles/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.roles }),
  });
}

// ---- Number series ----
export const useSequences = (branchId: string | undefined) =>
  useQuery({
    queryKey: keys.sequences(branchId ?? ""),
    queryFn: ({ signal }) => api.get<DocumentSequence[]>("/document-sequences", { branchId }, signal),
    enabled: Boolean(branchId),
  });

export function useUpdateSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ branchId, docType, body }: { branchId: string; docType: DocumentType; body: unknown }) =>
      api.patch<DocumentSequence>(`/document-sequences/${branchId}/${docType}`, body),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: keys.sequences(v.branchId) }),
  });
}

// ---- Settings ----
export interface AllSettings {
  tax: TaxSettings;
  print: PrintSettings;
  pos: PosSettings;
  inventory: InventorySettings;
}

export const useSettings = () =>
  useQuery({ queryKey: keys.settings, queryFn: ({ signal }) => api.get<AllSettings>("/settings", undefined, signal) });

export function useUpdateSettings(group: SettingsGroup) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.patch(`/settings/${group}`, body),
    onSuccess: (value) =>
      qc.setQueryData<AllSettings>(keys.settings, (old) => (old ? { ...old, [group]: value } : old)),
  });
}

// ---- Audit ----
export interface AuditFilters {
  page: number;
  action?: string;
  entity?: string;
}

export const useAuditLogs = (f: AuditFilters) =>
  useQuery({
    queryKey: keys.audit(f),
    queryFn: ({ signal }) => api.list<AuditLog>("/audit-logs", { ...f, limit: 25 }, signal),
    placeholderData: keepPreviousData,
  });
