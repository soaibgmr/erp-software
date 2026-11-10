import pino from "pino";
import { env, isProduction } from "./env";

// Structured JSON logs. Never log tokens, passwords or payment payloads.
export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL,
  base: { service: "erp-software-api" },
  redact: {
    paths: ["req.headers.authorization", "req.headers.clientid", "*.password", "*.refreshToken", "*.token"],
    censor: "[redacted]",
  },
  ...(isProduction ? {} : { timestamp: pino.stdTimeFunctions.isoTime }),
});
