import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}

const widths = { sm: "max-w-[480px]", md: "max-w-[640px]", lg: "max-w-[880px]" };

// 14px radius, Esc and backdrop close, focus moves into the dialog and returns on close.
export function Modal({ open, onClose, title, children, footer, size = "sm" }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = panel.current?.querySelector<HTMLElement>("input, select, textarea, button:not([data-close])");
    (focusable ?? panel.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-900/40 p-4 sm:items-center">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn("relative my-8 w-full rounded-modal bg-surface shadow-modal focus:outline-none", widths[size])}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <h2 className="text-section font-semibold text-ink">{title}</h2>
          <button
            data-close
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 rounded-input p-1.5 text-slate hover:bg-navy-50"
          >
            <X className="size-[18px]" />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-3 px-6 pb-5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// Title is a question; buttons are verbs; the destructive action sits on the right.
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = true,
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? "danger" : "primary"} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-body text-slate">{body}</div>
    </Modal>
  );
}
