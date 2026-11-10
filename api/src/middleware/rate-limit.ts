import type { RequestHandler } from "express";
import { tooManyAttempts, type IAttemptLimiter } from "../common/attempt-limiter";
import { logger } from "../config/logger";

// Fixed-window limit per client IP, counted in the database so every serverless instance shares it.
// If the counter can't be reached the request goes through (logged): a database hiccup shouldn't block sign-in.
export function rateLimit(
  limiter: IAttemptLimiter,
  { windowMs, max, name }: { windowMs: number; max: number; name: string },
): RequestHandler {
  return async (req, _res, next) => {
    let result: { count: number; resetAt: Date };
    try {
      result = await limiter.hit(`ip:${name}:${req.ip ?? "unknown"}`, windowMs);
    } catch (err) {
      logger.warn({ err, name }, "rate limit check failed; allowing request");
      return next();
    }
    if (result.count > max) throw tooManyAttempts(result.resetAt);
    next();
  };
}
