import { formatQty, type StockAdjustmentStatus, type StockTransferStatus } from "@erp-software/shared";
import type { Tone } from "@/components/ui/Badge";

export const adjustmentStatusBadge: Record<StockAdjustmentStatus, { tone: Tone; label: string }> = {
  PENDING: { tone: "warning", label: "Awaiting approval" },
  POSTED: { tone: "success", label: "Posted" },
  REJECTED: { tone: "neutral", label: "Rejected" },
};

export const transferStatusBadge: Record<StockTransferStatus, { tone: Tone; label: string }> = {
  IN_TRANSIT: { tone: "info", label: "In transit" },
  RECEIVED: { tone: "success", label: "Received" },
  CANCELLED: { tone: "neutral", label: "Cancelled" },
};

// "12 PCS", "1.5 LTR"; the unit is dropped for pieces.
export const qtyWithUnit = (q: string | number, unit: string) =>
  unit === "PCS" ? formatQty(q) : `${formatQty(q)} ${unit}`;
