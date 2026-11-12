import express from "express";
import cors from "cors";
import { env, isProduction } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { requestLogger } from "./middleware/request-logger";
import { apiRoutes, publicRoutes } from "./modules/index.routes";

// Outside production any local origin works (Vite may move to 5174, or the app opened via 127.0.0.1).
// Production only accepts the origins listed in CORS_ORIGIN.
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
const isAllowedOrigin = (origin: string) =>
  env.CORS_ORIGIN.includes(origin) || (!isProduction && LOCAL_ORIGIN.test(origin));

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(requestLogger);
app.use(
  cors({
    origin: (origin, callback) => callback(null, !origin || isAllowedOrigin(origin)),
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "clientid",
      "x-branch-id",
      "x-request-id",
      "Idempotency-Key",
      "x-scan-token",
    ],
    exposedHeaders: ["x-request-id"],
  }),
);
// Bulk endpoints (a 2,000-row stock import) get a larger body limit than everything else.
const LARGE_BODY_PATHS = new Set(["/api/v1/stock/import"]);
const jsonBody = express.json({ limit: "1mb" });
const largeJsonBody = express.json({ limit: "5mb" });
app.use((req, res, next) => (LARGE_BODY_PATHS.has(req.path) ? largeJsonBody : jsonBody)(req, res, next));

app.use("/", publicRoutes);
app.use("/api/v1", apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
