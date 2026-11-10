import * as Sentry from "@sentry/node";
import { waitUntil } from "@vercel/functions";
import type { Request, Response } from "express";
import { env } from "./env";

// Error monitoring. Only unexpected errors (the ones answered with a 500) are sent; 4xx are normal
// business answers. No request bodies, headers or personal data are sent, only ids that help find the
// matching log line (request id, user id, business id, route).
const enabled = Boolean(env.SENTRY_DSN);

if (enabled) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    // Send no headers (tokens), cookies, bodies (passwords, customer data) or query strings.
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
    tracesSampleRate: 0,
    // Plain error reporting only: no automatic instrumentation of http, database or express.
    defaultIntegrations: false,
    integrations: [Sentry.linkedErrorsIntegration(), Sentry.dedupeIntegration()],
  });
}

export function reportError(err: unknown, req?: Request, res?: Response): void {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    if (req) {
      scope.setTag("route", `${req.method} ${req.route?.path ?? req.path}`);
      scope.setTag("request_id", String(req.id ?? ""));
      const auth = res?.locals.auth as { userId?: string; businessId?: string } | undefined;
      if (auth?.userId) scope.setUser({ id: auth.userId });
      if (auth?.businessId) scope.setTag("business_id", auth.businessId);
    }
    Sentry.captureException(err);
  });
  // Serverless functions freeze after the response, so keep them alive until the event is sent.
  waitUntil(Sentry.flush(2000));
}
