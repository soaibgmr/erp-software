import { inject, injectable } from "inversify";
import { PrismaClient } from "@prisma/client";
import { TYPES } from "../config/ioc.types";
import { HttpError } from "./http-error";

// Counts attempts per key in fixed windows, shared by every API instance (stored in `rate_limits`).
// Used for per-IP request limits and for locking an account after repeated wrong passwords.
export interface IAttemptLimiter {
  /** Adds one attempt and returns the count in the current window. */
  hit(key: string, windowMs: number): Promise<{ count: number; resetAt: Date }>;
  /** Attempts so far in the current window (0 when none or expired). */
  count(key: string): Promise<{ count: number; resetAt: Date | null }>;
  /** Clears the key, e.g. after a successful sign-in. */
  reset(key: string): Promise<void>;
}

export const tooManyAttempts = (resetAt: Date | null, now = Date.now()) => {
  const minutes = Math.max(1, Math.ceil(((resetAt?.getTime() ?? now) - now) / 60_000));
  return new HttpError(429, "TOO_MANY_REQUESTS", `Too many attempts. Please try again in ${minutes} minute(s).`);
};

// Failed sign-ins allowed per account in the window before it is locked until the window ends.
export const ACCOUNT_LOCK = { maxFailures: 8, windowMs: 15 * 60_000 } as const;

/** Throws 429 while the account key is locked. */
export async function assertNotLocked(limiter: IAttemptLimiter, key: string): Promise<void> {
  const { count, resetAt } = await limiter.count(key);
  if (count >= ACCOUNT_LOCK.maxFailures) throw tooManyAttempts(resetAt);
}

@injectable()
export class PrismaAttemptLimiter implements IAttemptLimiter {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  async hit(key: string, windowMs: number): Promise<{ count: number; resetAt: Date }> {
    // Both times come from the app, never the database's now(): Prisma sends dates as wall-clock text, so
    // mixing them with now() is off by the session time zone. One atomic statement: a new or expired
    // window starts at 1, otherwise the count goes up.
    const now = new Date();
    const resetAt = new Date(now.getTime() + windowMs);
    const rows = await this.prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
      INSERT INTO rate_limits (key, count, reset_at) VALUES (${key}, 1, ${resetAt})
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN rate_limits.reset_at <= ${now} THEN 1 ELSE rate_limits.count + 1 END,
        reset_at = CASE WHEN rate_limits.reset_at <= ${now} THEN EXCLUDED.reset_at ELSE rate_limits.reset_at END
      RETURNING count, reset_at AS "resetAt"`;
    // Now and then, drop windows that ended long ago so the table stays small.
    if (Math.random() < 0.01) {
      await this.prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date(now.getTime() - 86_400_000) } } });
    }
    const row = rows[0]!;
    return { count: Number(row.count), resetAt: new Date(row.resetAt) };
  }

  async count(key: string): Promise<{ count: number; resetAt: Date | null }> {
    const row = await this.prisma.rateLimit.findUnique({ where: { key } });
    if (!row || row.resetAt.getTime() <= Date.now()) return { count: 0, resetAt: null };
    return { count: row.count, resetAt: row.resetAt };
  }

  async reset(key: string): Promise<void> {
    await this.prisma.rateLimit.deleteMany({ where: { key } });
  }
}
