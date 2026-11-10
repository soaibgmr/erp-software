import * as Sentry from "@sentry/react";

// Error monitoring for the browser. Only crashes are reported (see RouteError); no session replay,
// performance tracing or personal data.
const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export function initMonitoring() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    defaultIntegrations: false,
    integrations: [Sentry.linkedErrorsIntegration(), Sentry.dedupeIntegration()],
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
  });
}

export function reportError(error: unknown) {
  if (dsn) Sentry.captureException(error);
}
