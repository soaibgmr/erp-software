import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CustomerType } from "@erp-software/shared";
import { api } from "@/lib/api-client";
import type { Customer } from "@/lib/types";

export interface CustomerFilters {
  page: number;
  search?: string;
  type?: CustomerType;
}

export const customerKeys = {
  all: ["customers"] as const,
  list: (f: CustomerFilters) => [...customerKeys.all, "list", f] as const,
  detail: (id: string) => [...customerKeys.all, "detail", id] as const,
};

export function useCustomers(filters: CustomerFilters) {
  return useQuery({
    queryKey: customerKeys.list(filters),
    queryFn: ({ signal }) => api.list<Customer>("/customers", { ...filters, limit: 20 }, signal),
    placeholderData: keepPreviousData,
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: customerKeys.detail(id ?? ""),
    queryFn: ({ signal }) => api.get<Customer>(`/customers/${id}`, undefined, signal),
    enabled: Boolean(id),
  });
}

export function useSaveCustomer(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) =>
      id ? api.patch<Customer>(`/customers/${id}`, body) : api.post<Customer>("/customers", body),
    onSuccess: (customer) => {
      qc.setQueryData(customerKeys.detail(customer.id), customer);
      qc.invalidateQueries({ queryKey: [...customerKeys.all, "list"] });
    },
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/customers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: customerKeys.all }),
  });
}
