import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToastInput {
  message: string;
  tone?: "success" | "error";
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<(t: ToastInput) => void>(() => {});

export const useToast = () => useContext(ToastContext);

// Navy bar, yellow check, optional yellow action (e.g. "Invoice INV-24-01874 saved · Print").
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((t: ToastInput) => {
    const id = Date.now() + Math.random();
    setItems((list) => [...list.slice(-2), { ...t, id }]);
    setTimeout(() => setItems((list) => list.filter((i) => i.id !== id)), t.tone === "error" ? 6000 : 4000);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-input px-4 py-3 text-body text-white shadow-modal",
              t.tone === "error" ? "bg-danger" : "bg-navy-900",
            )}
          >
            {t.tone === "error" ? (
              <AlertCircle className="size-4 shrink-0" />
            ) : (
              <Check className="size-4 shrink-0 text-yellow-400" />
            )}
            <span className="min-w-0 flex-1">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={t.action.onClick}
                className="font-semibold text-yellow-400 hover:text-yellow-500"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
