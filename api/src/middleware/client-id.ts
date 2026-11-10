import type { RequestHandler } from "express";
import { env } from "../config/env";
import { unauthorized } from "../common/http-error";

export const CLIENT_ID_HEADER = "clientid";

// Rejects requests whose `clientid` header doesn't match CLIENT_ID.
// When CLIENT_ID is unset (allowed outside production only, see env.ts) the check is skipped.
export const verifyClientId: RequestHandler = (req, res, next) => {
  if (!env.CLIENT_ID) return next();

  const header = req.headers[CLIENT_ID_HEADER];
  const clientId = Array.isArray(header) ? header[0] : header;

  if (!clientId) throw unauthorized("ClientId header is missing");
  if (clientId !== env.CLIENT_ID) throw unauthorized("Invalid Client Id");

  res.locals.clientId = clientId;
  next();
};
