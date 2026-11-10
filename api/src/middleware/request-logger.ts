import { randomUUID } from "node:crypto";
import { pinoHttp } from "pino-http";
import { logger } from "../config/logger";

// One log line per request with a request id (reused from x-request-id when present).
export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const id = (req.headers["x-request-id"] as string | undefined) ?? randomUUID();
    res.setHeader("x-request-id", id);
    return id;
  },
  customLogLevel: (_req, res, err) =>
    err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
