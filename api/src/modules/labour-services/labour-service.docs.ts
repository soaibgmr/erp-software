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
import {
  createLabourServiceSchema,
  listLabourServicesQuerySchema,
  updateLabourServiceSchema,
} from "./labour-service.schema";

export const labourServiceSchemas: Record<string, SchemaObject> = {
  LabourService: {
    type: "object",
    required: ["id", "name", "sacCode", "gstRate", "rate", "standardHours", "isActive"],
    properties: {
      id: { type: "string", format: "uuid" },
      code: { type: ["string", "null"] },
      name: { type: "string", example: "Periodic service" },
      sacCode: { type: "string", example: "998714" },
      gstRate: { type: "number", example: 18 },
      rate: { type: "string", example: "1450.00" },
      standardHours: { type: "string", example: "2.50" },
      isActive: { type: "boolean" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
};

const tag = "Labour services";

export const labourServicePaths: Paths = {
  "/api/v1/labour-services": {
    get: operation({
      tag,
      summary: "List labour services",
      description: "Requires `inventory.view`, `inventory.manage` or `pos.use`.",
      parameters: queryParams(listLabourServicesQuerySchema),
      responses: {
        200: success("Labour services", { type: "array", items: ref("LabourService") }, { paginated: true }),
      },
    }),
    post: operation({
      tag,
      summary: "Create a labour service",
      description: "Requires `inventory.manage`. SAC defaults to 998714 (maintenance and repair of motor vehicles).",
      body: fromZod(createLabourServiceSchema),
      responses: { 201: success("Labour service created", ref("LabourService")) },
    }),
  },
  "/api/v1/labour-services/{id}": {
    get: operation({
      tag,
      summary: "Get a labour service",
      parameters: [pathParam("id")],
      responses: { 200: success("Labour service", ref("LabourService")) },
    }),
    patch: operation({
      tag,
      summary: "Update a labour service",
      description: "Requires `inventory.manage`. Rate and GST changes are audited.",
      parameters: [pathParam("id")],
      body: fromZod(updateLabourServiceSchema),
      responses: { 200: success("Labour service updated", ref("LabourService")) },
    }),
    delete: operation({
      tag,
      summary: "Soft-delete a labour service",
      description: "Requires `inventory.manage`.",
      parameters: [pathParam("id")],
      responses: { 200: success("Labour service deleted", { type: "null" }) },
    }),
  },
};
