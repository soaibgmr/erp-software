import type { AuthTokenPurpose } from "@prisma/client";

// One-time tokens sent by email. Only SHA-256 hashes are stored.
export interface IAuthTokenRepository {
  create(userId: string, purpose: AuthTokenPurpose, tokenHash: string, expiresAt: Date): Promise<void>;
  // Marks an unused, unexpired token as used and returns its user; null when invalid, used or expired.
  consume(tokenHash: string, purpose: AuthTokenPurpose): Promise<string | null>;
  // Older links stop working once a new one is sent.
  invalidateAll(userId: string, purpose: AuthTokenPurpose): Promise<void>;
}
