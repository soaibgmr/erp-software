import type { RequestHandler } from "express";
import { HttpError } from "../common/http-error";

// Fixed-window limit per client IP, kept in memory. Enough to slow down password guessing and sign-up spam
// from one address. On serverless hosts every instance counts on its own, so treat it as a speed bump.
export function rateLimit({ windowMs, max, name }: { windowMs: number; max: number; name: string }): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req, _res, next) => {
    const now = Date.now();
    // Drop old windows now and then so the map can't grow without bound.
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);

    const key = `${name}:${req.ip ?? "unknown"}`;
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      const minutes = Math.ceil((entry.resetAt - now) / 60_000);
      throw new HttpError(429, "TOO_MANY_REQUESTS", `Too many attempts. Please try again in ${minutes} minute(s).`);
    }
    next();
  };
}
