import type { CustomerType } from "@erp-software/shared";
import type { Tone } from "@/components/ui/Badge";

export const customerTypeTone: Record<CustomerType, Tone> = { RETAIL: "neutral", FLEET: "info", B2B: "highlight" };
