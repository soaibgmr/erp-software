import type { ErrorRequestHandler, RequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { HttpError } from "../common/http-error";
import { sendError } from "../common/api-response";
import { reportError } from "../config/monitoring";

export const notFoundHandler: RequestHandler = (req, res) => {
  sendError(res, 404, "NOT_FOUND", `Route ${req.method} ${req.path} not found`);
};

// The services check these first; the database index only fires when two people save at once.
const DUPLICATE_MESSAGES: Record<string, string> = {
  items_business_id_sku_active_key: "This SKU is already used by another item",
  item_barcodes_business_id_code_key: "This barcode is already on another item",
  customers_business_id_mobile_active_key: "This mobile number already belongs to another customer",
};

function duplicateMessage(err: Prisma.PrismaClientKnownRequestError): string {
  const text = `${err.message} ${JSON.stringify(err.meta ?? {})}`;
  const index = Object.keys(DUPLICATE_MESSAGES).find((name) => text.includes(name));
  return index ? DUPLICATE_MESSAGES[index] : "Resource already exists";
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    sendError(res, err.status, err.code, err.message, err.details);
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      sendError(res, 409, "CONFLICT", duplicateMessage(err));
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
