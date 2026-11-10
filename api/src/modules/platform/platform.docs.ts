import { BUSINESS_STATUSES, businessStatusUpdateSchema, platformLoginSchema } from "@erp-software/shared";
import {
  fromZod,
  operation,
  pathParam,
  type Paths,
  queryParams,
  ref,
  type SchemaObject,
  success,
} from "../../docs/openapi.helpers";
import { listBusinessesQuerySchema } from "./platform.schema";

const s = { type: ["string", "null"] };

export const platformSchemas: Record<string, SchemaObject> = {
  PlatformAdmin: {
    type: "object",
    properties: { id: { type: "string", format: "uuid" }, name: { type: "string" }, email: { type: "string" } },
  },
  PlatformBusiness: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      name: { type: "string" },
      legalName: { type: "string" },
      city: s,
      stateCode: { type: "string" },
      gstin: s,
      status: { type: "string", enum: [...BUSINESS_STATUSES] },
      statusNote: s,
      approvedAt: { type: ["string", "null"], format: "date-time" },
      createdAt: { type: "string", format: "date-time" },
      owner: {
        type: ["object", "null"],
        properties: { name: { type: "string" }, mobile: s, email: s, emailVerified: { type: "boolean" } },
      },
      branchCount: { type: "integer" },
      userCount: { type: "integer" },
    },
  },
};

const tag = "Platform";
const note = "Needs a platform-admin token (from `POST /api/v1/platform/auth/login`); shop tokens are rejected.";

export const platformPaths: Paths = {
  "/api/v1/platform/auth/login": {
    post: operation({
      tag,
      summary: "Platform admin login",
      description: "Returns a 12-hour token with audience `platform`. It never opens shop data.",
      auth: "client",
      body: fromZod(platformLoginSchema),
      responses: {
        200: success("Logged in", {
          type: "object",
          properties: { admin: ref("PlatformAdmin"), token: { type: "string" } },
        }),
      },
    }),
  },
  "/api/v1/platform/me": {
    get: operation({
      tag,
      summary: "Current platform admin",
      description: note,
      responses: { 200: success("Admin", ref("PlatformAdmin")) },
    }),
  },
  "/api/v1/platform/businesses": {
    get: operation({
      tag,
      summary: "Registered shops",
      description: `${note} Shops waiting for approval come first.`,
      parameters: queryParams(listBusinessesQuerySchema),
      responses: { 200: success("Shops", { type: "array", items: ref("PlatformBusiness") }) },
    }),
  },
  "/api/v1/platform/businesses/{id}/status": {
    patch: operation({
      tag,
      summary: "Approve, reject or suspend a shop",
      description: `${note} ACTIVE approves (or reactivates); REJECTED only for waiting shops; SUSPENDED only for active shops. The owner is emailed.`,
      parameters: [pathParam("id")],
      body: fromZod(businessStatusUpdateSchema),
      responses: { 200: success("Status changed", ref("PlatformBusiness")) },
    }),
  },
};
