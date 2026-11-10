import { useEffect } from "react";
import { isRouteErrorResponse, useRouteError } from "react-router";
import { reportError } from "@/lib/monitoring";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/States";

// Shown instead of a blank or technical page when a screen crashes while rendering.
// The cart and other in-progress work live in their own state, so reloading is usually enough.
export function RouteError() {
  const error = useRouteError();
  useEffect(() => {
    if (import.meta.env.DEV) console.error(error);
    // A missing page (404 from the router) isn't a crash.
    if (!isRouteErrorResponse(error)) reportError(error);
  }, [error]);
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : "Please reload the page. If it keeps happening, note what you were doing and tell your administrator.";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-md">
        <ErrorBanner
          title="Something went wrong on this screen"
          message={message}
          onRetry={() => window.location.reload()}
          extra={
            <Button size="sm" variant="outline" onClick={() => window.location.assign("/")}>
              Go to dashboard
            </Button>
          }
        />
      </div>
    </div>
  );
}
