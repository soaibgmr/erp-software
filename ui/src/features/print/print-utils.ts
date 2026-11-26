import type { PrintParam } from "@erp-software/shared";
import type { Branch, Business } from "@/lib/types";

export type PaperSize = PrintParam;

export const isReceipt = (size: PaperSize) => size === "thermal" || size === "thermal58";

export const joinAddress = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(", ");

// GSTIN printed on documents: the branch's own registration, else the business's.
export const sellerGstin = (business: Business, branch: Branch) => branch.gstin ?? business.gstin;
