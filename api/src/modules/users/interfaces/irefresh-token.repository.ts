import type { CreateRefreshTokenData, RefreshTokenRecord } from "../user.types";

export interface IRefreshTokenRepository {
  create(data: CreateRefreshTokenData): Promise<void>;
  // Returns the row whether or not it is revoked/expired, so reuse can be detected.
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  // Atomic: returns false if the token was already revoked (e.g. a concurrent refresh won).
  revokeIfActive(id: string): Promise<boolean>;
  revokeAllForUser(userId: string): Promise<void>;
}
