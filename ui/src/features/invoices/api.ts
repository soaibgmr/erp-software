import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InvoiceStatus, PaymentMethod } from "@erp-software/shared";
import { useAuth } from "@/app/auth";
import { api } from "@/lib/api-client";
import type {
  CreditNote,
  CustomerCredit,
  HeldCart,
  InvoiceDetail,
  InvoicePrint,
  InvoiceSummary,
  Quote,
  Shift,
  ShiftReport,
} from "@/lib/types";

// Shared by the POS, invoices and print features. Branch-scoped keys include the branch id.
const useBranchId = () => useAuth().branch?.id ?? "none";

export const salesKeys = {
  invoices: (branchId: string, f: object) => ["invoices", "list", branchId, f] as const,
  invoice: (id: string) => ["invoices", "detail", id] as const,
  print: (id: string) => ["invoices", "print", id] as const,
  creditNotes: (branchId: string, f: object) => ["credit-notes", branchId, f] as const,
  creditNote: (id: string) => ["credit-notes", "detail", id] as const,
  customerCredit: (id: string) => ["customer-credit", id] as const,
  shift: (branchId: string) => ["shifts", "current", branchId] as const,
  shifts: (branchId: string, f: object) => ["shifts", "list", branchId, f] as const,
  shiftReport: (id: string) => ["shifts", "report", id] as const,
  held: (branchId: string) => ["held-carts", branchId] as const,
};

// Invalidated after anything that changes money or stock.
function invalidateSales(qc: ReturnType<typeof useQueryClient>) {
  for (const key of ["invoices", "credit-notes", "customer-credit", "shifts", "held-carts", "inventory"]) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}

// ---------- Cart ----------

export type CartLineBody =
  | { kind: "ITEM"; itemId: string; quantity: number; discount?: number }
  | { kind: "LABOUR"; labourServiceId: string; quantity: number; discount?: number };

export interface CartBody {
  customerId?: string | null;
  lines: CartLineBody[];
  billDiscount?: { type: "AMOUNT" | "PERCENT"; value: number } | null;
}

export interface ChargeBody extends CartBody {
  payments: { mode: PaymentMethod; amount: number; tendered?: number | null; reference?: string | null }[];
  notes?: string | null;
  expectedTotal?: number;
  heldCartId?: string;
  override?: { email: string; password: string };
}

// Server-side totals for the cart (the POS also prices locally with the shared engine for instant feedback).
export function useQuote(body: CartBody | null) {
  const branchId = useBranchId();
  return useQuery({
    queryKey: ["quote", branchId, body],
    queryFn: () => api.post<Quote>("/pos/quote", body),
    enabled: Boolean(body?.lines.length),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}

// One Idempotency-Key per attempt: the POS keeps it until the charge succeeds, so a retry never double-bills.
export function useCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, key }: { body: ChargeBody; key: string }) =>
      api.post<InvoiceDetail>("/invoices", body, { headers: { "Idempotency-Key": key } }),
    onSuccess: () => invalidateSales(qc),
  });
}

export const useCustomerCredit = (customerId: string | null | undefined) =>
  useQuery({
    queryKey: salesKeys.customerCredit(customerId ?? ""),
    queryFn: ({ signal }) => api.get<CustomerCredit>(`/invoices/customer-credit/${customerId}`, undefined, signal),
    enabled: Boolean(customerId),
  });

// ---------- Held carts ----------

export function useHeldCarts() {
  const branchId = useBranchId();
  return useQuery({
    queryKey: salesKeys.held(branchId),
    queryFn: ({ signal }) => api.get<HeldCart[]>("/pos/held-carts", undefined, signal),
  });
}

export function useHoldCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CartBody & { label?: string | null }) => api.post<HeldCart>("/pos/held-carts", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["held-carts"] }),
  });
}

export function useDiscardHeldCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/pos/held-carts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["held-carts"] }),
  });
}

// ---------- Shifts ----------

export function useCurrentShift() {
  const branchId = useBranchId();
  return useQuery({
    queryKey: salesKeys.shift(branchId),
    queryFn: ({ signal }) => api.get<ShiftReport | null>("/shifts/current", undefined, signal),
  });
}

export function useShifts(filters: { page: number; status?: "OPEN" | "CLOSED" }) {
  const branchId = useBranchId();
  return useQuery({
    queryKey: salesKeys.shifts(branchId, filters),
    queryFn: ({ signal }) => api.list<Shift>("/shifts", { ...filters, limit: 20 }, signal),
    placeholderData: keepPreviousData,
  });
}

export const useShiftReport = (id: string | undefined) =>
  useQuery({
    queryKey: salesKeys.shiftReport(id ?? ""),
    queryFn: ({ signal }) => api.get<ShiftReport>(`/shifts/${id}/report`, undefined, signal),
    enabled: Boolean(id),
  });

export function useOpenShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { counter: string; openingCash: number }) => api.post<ShiftReport>("/shifts/open", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });
}

export function useCloseShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { counted: Partial<Record<PaymentMethod, number>>; note?: string | null };
    }) => api.post<ShiftReport>(`/shifts/${id}/close`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });
}

// ---------- Invoices ----------

export interface InvoiceFilters {
  page: number;
  search?: string;
  status?: InvoiceStatus;
  customerId?: string;
  paymentMode?: PaymentMethod;
  from?: string; // YYYY-MM-DD
  to?: string;
  branchId?: string; // "all" for every accessible branch
}

export function useInvoices(filters: InvoiceFilters, { limit = 20, enabled = true } = {}) {
  const branchId = useBranchId();
  return useQuery({
    queryKey: salesKeys.invoices(branchId, { ...filters, limit }),
    queryFn: ({ signal }) => api.list<InvoiceSummary>("/invoices", { ...filters, limit }, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export const useInvoice = (id: string | undefined) =>
  useQuery({
    queryKey: salesKeys.invoice(id ?? ""),
    queryFn: ({ signal }) => api.get<InvoiceDetail>(`/invoices/${id}`, undefined, signal),
    enabled: Boolean(id),
  });

export const useInvoicePrint = (id: string | undefined) =>
  useQuery({
    queryKey: salesKeys.print(id ?? ""),
    queryFn: ({ signal }) => api.get<InvoicePrint>(`/invoices/${id}/print`, undefined, signal),
    enabled: Boolean(id),
  });

export function useCancelInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<InvoiceDetail>(`/invoices/${id}/cancel`, { reason }),
    onSuccess: () => invalidateSales(qc),
  });
}

export function useRecordPayment(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { mode: PaymentMethod; amount: number; reference?: string | null; note?: string | null }) =>
      api.post<InvoiceDetail>(`/invoices/${invoiceId}/payments`, body),
    onSuccess: () => invalidateSales(qc),
  });
}

export function useReversePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) =>
      api.post<InvoiceDetail>(`/payments/${paymentId}/reverse`, { reason }),
    onSuccess: () => invalidateSales(qc),
  });
}

// A customer's old dues (opening balance), entered once at go-live.
export function useAddOldDues() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { customerId: string; amount: number; asOfDate: string; note?: string | null }) =>
      api.post<InvoiceDetail>("/invoices/opening-balance", body),
    onSuccess: () => invalidateSales(qc),
  });
}

// ---------- Credit notes ----------

export function useCreditNotes(filters: { page: number; invoiceId?: string }) {
  const branchId = useBranchId();
  return useQuery({
    queryKey: salesKeys.creditNotes(branchId, filters),
    queryFn: ({ signal }) => api.list<CreditNote>("/credit-notes", { ...filters, limit: 20 }, signal),
    placeholderData: keepPreviousData,
  });
}

export const useCreditNote = (id: string | undefined) =>
  useQuery({
    queryKey: salesKeys.creditNote(id ?? ""),
    queryFn: ({ signal }) => api.get<CreditNote>(`/credit-notes/${id}`, undefined, signal),
    enabled: Boolean(id),
  });

export function useCreateCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      invoiceId: string;
      reason: string;
      lines: { invoiceLineId: string; quantity: number }[];
      refundMode: PaymentMethod;
    }) => api.post<CreditNote>("/credit-notes", body),
    onSuccess: () => invalidateSales(qc),
  });
}
