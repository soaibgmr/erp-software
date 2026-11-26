import { Router } from "express";
import { openApiDocument } from "./openapi";

// Mounted at /docs (see index.routes.ts): Swagger UI plus the raw spec at /docs/openapi.json.
//
// The Swagger UI page loads its JS/CSS from jsDelivr instead of serving swagger-ui-dist from disk:
// on Vercel the function only ships files that code require()s, so the static assets were missing
// and every asset URL fell through to the HTML page (blank page, "Unexpected token '<'").
// Keep the version in step with the installed swagger-ui-dist.
const SWAGGER_UI = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.34.1";

export const docsRouter = Router();

docsRouter.get("/openapi.json", (req, res) => {
  res.json(openApiDocument);
});

docsRouter.get("/", (req, res) => {
  // "/docs" → "/docs/", so the page and its spec URL resolve the same way with or without the slash.
  if (!req.originalUrl.split("?")[0].endsWith("/")) {
    res.redirect(301, `${req.baseUrl}/`);
    return;
  }
  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ERP Software API</title>
  <link rel="stylesheet" href="${SWAGGER_UI}/swagger-ui.css" />
  <link rel="icon" type="image/png" href="${SWAGGER_UI}/favicon-32x32.png" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${SWAGGER_UI}/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: "${req.baseUrl}/openapi.json",
      dom_id: "#swagger-ui",
      persistAuthorization: true,
    });
  </script>
</body>
</html>`);
});
