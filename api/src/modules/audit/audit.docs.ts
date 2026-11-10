import { operation, type Paths, queryParams, ref, type SchemaObject, success } from "../../docs/openapi.helpers";
import { listAuditLogsQuerySchema } from "./audit.schema";

export const auditSchemas: Record<string, SchemaObject> = {
  AuditLog: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      action: { type: "string", example: "customer.delete" },
      entity: { type: "string", example: "Customer" },
      entityId: { type: ["string", "null"] },
      branchId: { type: ["string", "null"], format: "uuid" },
      before: {},
      after: {},
      ip: { type: ["string", "null"] },
      createdAt: { type: "string", format: "date-time" },
      actor: {
        type: ["object", "null"],
        properties: { id: { type: "string" }, firstName: { type: "string" }, lastName: { type: "string" } },
      },
    },
  },
};

export const auditPaths: Paths = {
  "/api/v1/audit-logs": {
    get: operation({
      tag: "Audit",
      summary: "List audit log entries",
      description: "Requires `audit.view`. Newest first. `action` matches by prefix (e.g. `customer.`).",
      parameters: queryParams(listAuditLogsQuerySchema),
      responses: { 200: success("Audit log", { type: "array", items: ref("AuditLog") }, { paginated: true }) },
    }),
  },
};
