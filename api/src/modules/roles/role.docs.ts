import { PERMISSIONS } from "@automobile/shared";
import { fromZod, operation, pathParam, type Paths, ref, type SchemaObject, success } from "../../docs/openapi.helpers";
import { createRoleSchema, updateRoleSchema } from "./role.schema";

export const roleSchemas: Record<string, SchemaObject> = {
  Role: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      key: { type: ["string", "null"], description: "Set on system roles, e.g. OWNER, COUNTER." },
      name: { type: "string" },
      description: { type: ["string", "null"] },
      permissions: { type: "array", items: { type: "string", enum: [...PERMISSIONS] } },
      isSystem: { type: "boolean" },
      userCount: { type: "integer" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  PermissionGroup: {
    type: "object",
    properties: {
      group: { type: "string" },
      permissions: {
        type: "array",
        items: { type: "object", properties: { code: { type: "string" }, label: { type: "string" } } },
      },
    },
  },
};

const tag = "Roles";

export const rolePaths: Paths = {
  "/api/v1/permissions": {
    get: operation({
      tag,
      summary: "Permission catalog",
      description: "Every permission code, grouped for the role editor.",
      responses: { 200: success("Permissions", { type: "array", items: ref("PermissionGroup") }) },
    }),
  },
  "/api/v1/roles": {
    get: operation({
      tag,
      summary: "List roles",
      description: "Requires `role.manage` or `user.manage`.",
      responses: { 200: success("Roles", { type: "array", items: ref("Role") }) },
    }),
    post: operation({
      tag,
      summary: "Create a role",
      description: "Requires `role.manage`. Non-owners can only grant permissions they have.",
      body: fromZod(createRoleSchema),
      responses: { 201: success("Role created", ref("Role")) },
    }),
  },
  "/api/v1/roles/{id}": {
    get: operation({
      tag,
      summary: "Get a role",
      parameters: [pathParam("id")],
      responses: { 200: success("Role", ref("Role")) },
    }),
    patch: operation({
      tag,
      summary: "Update a role",
      description: "Requires `role.manage`. The Owner role can't be changed.",
      parameters: [pathParam("id")],
      body: fromZod(updateRoleSchema),
      responses: { 200: success("Role updated", ref("Role")) },
    }),
    delete: operation({
      tag,
      summary: "Soft-delete a role",
      description: "Requires `role.manage`. System roles and roles with users can't be deleted.",
      parameters: [pathParam("id")],
      responses: { 200: success("Role deleted", { type: "null" }) },
    }),
  },
};
