import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { openApiDocument } from "./openapi";

// Mounted at /docs (see index.routes.ts): Swagger UI plus the raw spec at /docs/openapi.json.
export const docsRouter = Router();

docsRouter.get("/openapi.json", (req, res) => {
  res.json(openApiDocument);
});

docsRouter.use(
  "/",
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, {
    customSiteTitle: "ERP Software API",
    swaggerOptions: { persistAuthorization: true },
  }),
);
