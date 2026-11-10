import type { NextFunction, Request, RequestHandler, Response } from "express";

// Forwards a rejected promise to the error handler.
// Express 5 already does this for every handler, so routes don't need it; it's kept for
// callbacks invoked outside Express's own dispatch (e.g. handlers composed manually).
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
