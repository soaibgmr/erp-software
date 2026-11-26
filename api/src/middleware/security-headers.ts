import type { RequestHandler } from "express";

// Standard security headers (what helmet would set, without the dependency). The API returns JSON,
// so it may not be framed or run anything; Swagger UI at /docs loads its JS/CSS from jsDelivr.
const API_CSP = "default-src 'none'; frame-ancestors 'none'";
const DOCS_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https://cdn.jsdelivr.net; " +
  "frame-ancestors 'none'";

export const securityHeaders: RequestHandler = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  res.setHeader("Content-Security-Policy", req.path.startsWith("/docs") ? DOCS_CSP : API_CSP);
  next();
};
