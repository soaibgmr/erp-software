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
import { createBranchSchema, listBranchesQuerySchema, updateBranchSchema } from "./branch.schema";

const nullableString = { type: ["string", "null"] };

export const branchSchemas: Record<string, SchemaObject> = {
  Branch: {
    type: "object",
    required: ["id", "code", "name", "stateCode", "isActive"],
    properties: {
      id: { type: "string", format: "uuid" },
      code: { type: "string", example: "KOC" },
      name: { type: "string", example: "Kochi · Main branch" },
      address: nullableString,
      city: nullableString,
      pincode: nullableString,
      stateCode: { type: "string", example: "32" },
      gstin: nullableString,
      phone: nullableString,
      isActive: { type: "boolean" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
};

const tag = "Branches";
const manage = "Requires `branch.manage`.";

export const branchPaths: Paths = {
  "/api/v1/branches": {
    get: operation({
      tag,
      summary: "List branches",
      description: "Owners see every branch; other users only the branches they are assigned to.",
      parameters: queryParams(listBranchesQuerySchema),
      responses: { 200: success("Branches", { type: "array", items: ref("Branch") }) },
    }),
    post: operation({
      tag,
      summary: "Create a branch",
      description: manage,
      body: fromZod(createBranchSchema),
      responses: { 201: success("Branch created", ref("Branch")) },
    }),
  },
  "/api/v1/branches/{id}": {
    get: operation({
      tag,
      summary: "Get a branch",
      parameters: [pathParam("id")],
      responses: { 200: success("Branch", ref("Branch")) },
    }),
    patch: operation({
      tag,
      summary: "Update a branch",
      description: `${manage} The last active branch can't be deactivated.`,
      parameters: [pathParam("id")],
      body: fromZod(updateBranchSchema),
      responses: { 200: success("Branch updated", ref("Branch")) },
    }),
    delete: operation({
      tag,
      summary: "Soft-delete a branch",
      description: `${manage} The last active branch can't be deleted.`,
      parameters: [pathParam("id")],
      responses: { 200: success("Branch deleted", { type: "null" }) },
    }),
  },
};
