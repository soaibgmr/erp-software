import type { ErrorRequestHandler, RequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { HttpError } from "../common/http-error";
import { sendError } from "../common/api-response";
import { reportError } from "../config/monitoring";

export const notFoundHandler: RequestHandler = (req, res) => {
  sendError(res, 404, "NOT_FOUND", `Route ${req.method} ${req.path} not found`);
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    sendError(res, err.status, err.code, err.message, err.details);
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      sendError(res, 409, "CONFLICT", "Resource already exists");
      return;
    }
    if (err.code === "P2025") {
      sendError(res, 404, "NOT_FOUND", "Not found");
      return;
    }
  }

  // Malformed JSON bodies from express.json()
  if (err?.type === "entity.parse.failed") {
    sendError(res, 400, "BAD_REQUEST", "Malformed JSON body");
    return;
  }

  req.log?.error({ err }, "Unhandled error");
  reportError(err, req, res);
  sendError(res, 500, "INTERNAL_ERROR", "Internal server error");
};
