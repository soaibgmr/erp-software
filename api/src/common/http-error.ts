export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, "BAD_REQUEST", message, details);
export const unauthorized = (message = "Unauthorized") => new HttpError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "Forbidden") => new HttpError(403, "FORBIDDEN", message);
export const notFound = (message = "Not found") => new HttpError(404, "NOT_FOUND", message);
export const conflict = (message: string) => new HttpError(409, "CONFLICT", message);
export const unprocessable = (message: string, details?: unknown) =>
  new HttpError(422, "UNPROCESSABLE", message, details);

// 400 shaped like zod's flattenError, so the UI maps service-level rule failures onto form fields too.
export const fieldErrors = (issues: { path: string; message: string }[]) =>
  badRequest(issues[0]?.message ?? "Invalid request body", {
    formErrors: [],
    fieldErrors: Object.fromEntries(issues.map((i) => [i.path, [i.message]])),
  });
