import type { RequestHandler } from "express";
import { z } from "zod";
import { badRequest } from "../common/http-error";

type Schemas = {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
};

// Parsed values go on res.locals: Express 5 makes req.query a read-only getter.
export function validate(schemas: Schemas): RequestHandler {
  return (req, res, next) => {
    for (const key of ["params", "query", "body"] as const) {
      const schema = schemas[key];
      if (!schema) continue;

      const result = schema.safeParse(req[key] ?? {});
      if (!result.success) {
        throw badRequest(`Invalid request ${key}`, z.flattenError(result.error));
      }
      res.locals[key] = result.data;
    }
    next();
  };
}
