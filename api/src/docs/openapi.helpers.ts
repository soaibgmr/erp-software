import { z } from "zod";

// Loose OpenAPI 3.1 object types: enough structure for the helpers below without pulling in a types package.
export type SchemaObject = Record<string, unknown>;
export type Operation = Record<string, unknown>;
export type Paths = Record<string, Record<string, Operation>>;

export const ref = (name: string): SchemaObject => ({ $ref: `#/components/schemas/${name}` });

// Request-side JSON Schema straight from a zod schema, so the docs can't drift from validate().
// io: "input" documents what the client sends (fields with defaults are optional, coerced query params keep their input type).
export function fromZod(schema: z.ZodType): SchemaObject {
  const { $schema, ...json } = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" });
  return json;
}

export function queryParams(schema: z.ZodObject) {
  const { properties = {}, required = [] } = fromZod(schema) as { properties?: Record<string, SchemaObject>; required?: string[] };
  return Object.entries(properties).map(([name, schema]) => ({ name, in: "query", required: required.includes(name), schema }));
}

export const pathParam = (name: string, schema: SchemaObject = { type: "string", format: "uuid" }) => ({
  name,
  in: "path",
  required: true,
  schema,
});

export const jsonBody = (schema: SchemaObject) => ({ required: true, content: { "application/json": { schema } } });

// Success envelope from src/common/api-response.ts: { success: true, message?, data, meta? }
export function success(description: string, data: SchemaObject, { paginated = false } = {}) {
  const schema = {
    type: "object",
    required: ["success", "data"],
    properties: {
      success: { const: true },
      message: { type: "string" },
      data,
      ...(paginated && { meta: ref("PaginationMeta") }),
    },
  };
  return { description, content: { "application/json": { schema } } };
}

type OperationOptions = {
  tag: string;
  summary: string;
  description?: string;
  // "bearer" = clientid header + JWT, "client" = clientid header only, "none" = public route.
  auth?: "bearer" | "client" | "none";
  parameters?: unknown[];
  body?: SchemaObject;
  responses: Record<number, unknown>;
};

export function operation({ tag, summary, description, auth = "bearer", parameters, body, responses }: OperationOptions): Operation {
  const security = { bearer: [{ clientId: [], bearerAuth: [] }], client: [{ clientId: [] }], none: [] }[auth];

  return {
    tags: [tag],
    summary,
    ...(description && { description }),
    security,
    ...(parameters?.length && { parameters }),
    ...(body && { requestBody: jsonBody(body) }),
    responses,
  };
}
