import type { BusinessStatus } from "@prisma/client";
import { HttpError } from "./http-error";

// JWT audience of platform-admin tokens. Shop routes reject it; platform routes require it.
export const PLATFORM_AUDIENCE = "platform";

const BLOCKED: Record<Exclude<BusinessStatus, "ACTIVE">, { code: string; message: string }> = {
  PENDING: {
    code: "BUSINESS_PENDING",
    message: "Your shop is waiting for approval. We'll email you as soon as it is active.",
  },
  SUSPENDED: {
    code: "BUSINESS_SUSPENDED",
    message: "This shop's account is suspended. Please contact support.",
  },
  REJECTED: {
    code: "BUSINESS_REJECTED",
    message: "This shop's registration was not approved. Please contact support.",
  },
};

// Shop users can only sign in and work while their business is ACTIVE.
export function assertBusinessActive(status: BusinessStatus): void {
  if (status === "ACTIVE") return;
  const { code, message } = BLOCKED[status];
  throw new HttpError(403, code, message);
}
