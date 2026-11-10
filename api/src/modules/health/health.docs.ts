import { operation, type Paths, success } from "../../docs/openapi.helpers";

const status = {
  type: "object",
  properties: {
    status: { const: "ok" },
    timezone: {
      type: "string",
      example: "Asia/Kolkata",
      description: "APP_TIMEZONE: the IANA zone the app formats dates in.",
    },
  },
};
const dbStatus = { type: "object", properties: { status: { const: "ok" }, database: { const: "up" } } };

const health = operation({
  tag: "Health",
  summary: "Liveness check and app timezone",
  auth: "none",
  responses: { 200: success("API is up", status) },
});

const healthDb = operation({
  tag: "Health",
  summary: "Database connectivity check",
  auth: "none",
  responses: {
    200: success("Database is reachable", dbStatus),
    503: { $ref: "#/components/responses/ServiceUnavailable" },
  },
});

// Registered before the clientid check, so no header needed.
export const healthPaths: Paths = {
  "/api/v1/health": { get: health },
  "/api/v1/health/db": { get: healthDb },
};
