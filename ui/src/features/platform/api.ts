import { useCallback, useSyncExternalStore } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BusinessStatus, BusinessStatusUpdate } from "@erp-software/shared";
import { api } from "@/lib/api-client";
import type { DemoRequest, PlatformAdmin, PlatformBusiness } from "@/lib/types";

// The platform admin console keeps its own token, apart from any shop login in the same browser.
const TOKEN_KEY = "ami.admin.token";
const listeners = new Set<() => void>();

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked: the admin signs in again next time.
  }
  listeners.forEach((l) => l());
}

export function usePlatformToken() {
  const token = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    readToken,
    () => null,
  );
  const queryClient = useQueryClient();
  const signOut = useCallback(() => {
    writeToken(null);
    queryClient.removeQueries({ queryKey: platformKeys.all });
  }, [queryClient]);
  return { token, setToken: writeToken, signOut };
}

export const platformKeys = {
  all: ["platform"] as const,
  me: () => [...platformKeys.all, "me"] as const,
  shops: (filter: ShopFilter) => [...platformKeys.all, "shops", filter] as const,
  demoRequests: (filter: DemoRequestFilter) => [...platformKeys.all, "demo-requests", filter] as const,
};

export interface DemoRequestFilter {
  status?: "open" | "handled";
  page: number;
}

export interface ShopFilter {
  status?: BusinessStatus;
  search?: string;
  page: number;
}

export async function platformLogin(email: string, password: string) {
  const res = await api.post<{ admin: PlatformAdmin; token: string }>(
    "/platform/auth/login",
    { email, password },
    { bearer: null },
  );
  writeToken(res.token);
  return res.admin;
}

export function usePlatformMe(token: string | null) {
  return useQuery({
    queryKey: platformKeys.me(),
    queryFn: ({ signal }) => api.get<PlatformAdmin>("/platform/me", undefined, signal, { bearer: token }),
    enabled: Boolean(token),
    retry: false,
  });
}

export function usePlatformShops(token: string | null, filter: ShopFilter) {
  return useQuery({
    queryKey: platformKeys.shops(filter),
    queryFn: ({ signal }) =>
      api.list<PlatformBusiness>(
        "/platform/businesses",
        { status: filter.status, search: filter.search, page: filter.page, limit: 25 },
        signal,
        { bearer: token },
      ),
    enabled: Boolean(token),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateShopStatus(token: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: BusinessStatusUpdate & { id: string }) =>
      api.patch<PlatformBusiness>(`/platform/businesses/${id}/status`, body, { bearer: token }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...platformKeys.all, "shops"] }),
  });
}

export function useDemoRequests(token: string | null, filter: DemoRequestFilter) {
  return useQuery({
    queryKey: platformKeys.demoRequests(filter),
    queryFn: ({ signal }) =>
      api.list<DemoRequest>(
        "/platform/demo-requests",
        { status: filter.status, page: filter.page, limit: 25 },
        signal,
        { bearer: token },
      ),
    enabled: Boolean(token),
    placeholderData: keepPreviousData,
  });
}

export function useSetDemoRequestHandled(token: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, handled }: { id: string; handled: boolean }) =>
      api.patch<DemoRequest>(`/platform/demo-requests/${id}`, { handled }, { bearer: token }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...platformKeys.all, "demo-requests"] }),
  });
}
