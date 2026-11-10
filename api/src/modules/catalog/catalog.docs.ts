import { HSN_SAC_KINDS } from "@automobile/shared";
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
import { CATALOG_SCHEMAS, listCatalogQuerySchema } from "./catalog.schema";
import type { CatalogKind } from "./catalog.types";

const id = { type: "string", format: "uuid" };

export const catalogSchemas: Record<string, SchemaObject> = {
  ItemCategory: {
    type: "object",
    required: ["id", "name", "itemCount"],
    properties: {
      id,
      name: { type: "string", example: "Filters" },
      description: { type: ["string", "null"] },
      itemCount: { type: "integer" },
    },
  },
  Brand: {
    type: "object",
    required: ["id", "name", "itemCount"],
    properties: { id, name: { type: "string", example: "Bosch" }, itemCount: { type: "integer" } },
  },
  HsnSac: {
    type: "object",
    required: ["id", "code", "kind", "description", "gstRate"],
    properties: {
      id,
      code: { type: "string", example: "8421" },
      kind: { type: "string", enum: [...HSN_SAC_KINDS] },
      description: { type: "string" },
      gstRate: { type: "number", example: 18 },
    },
  },
  VehicleMake: {
    type: "object",
    required: ["id", "name", "modelCount"],
    properties: { id, name: { type: "string", example: "Maruti Suzuki" }, modelCount: { type: "integer" } },
  },
  VehicleModel: {
    type: "object",
    required: ["id", "makeId", "makeName", "name"],
    properties: { id, makeId: id, makeName: { type: "string" }, name: { type: "string", example: "Swift" } },
  },
};

const tag = "Catalog";

function crud(path: string, kind: CatalogKind, schema: string, noun: string, manage: string): Paths {
  const { create, update } = CATALOG_SCHEMAS[kind];
  return {
    [path]: {
      get: operation({
        tag,
        summary: `List ${noun}s`,
        description: "Open to every signed-in user. Not paginated (up to 1,000 rows).",
        parameters: queryParams(listCatalogQuerySchema),
        responses: { 200: success(`${noun}s`, { type: "array", items: ref(schema) }) },
      }),
      post: operation({
        tag,
        summary: `Create a ${noun}`,
        description: `Requires ${manage}. Names are unique among active rows (400 on \`name\`).`,
        body: fromZod(create),
        responses: { 201: success(`${noun} created`, ref(schema)) },
      }),
    },
    [`${path}/{id}`]: {
      get: operation({
        tag,
        summary: `Get a ${noun}`,
        parameters: [pathParam("id")],
        responses: { 200: success(noun, ref(schema)) },
      }),
      patch: operation({
        tag,
        summary: `Update a ${noun}`,
        description: `Requires ${manage}.`,
        parameters: [pathParam("id")],
        body: fromZod(update),
        responses: { 200: success(`${noun} updated`, ref(schema)) },
      }),
      delete: operation({
        tag,
        summary: `Soft-delete a ${noun}`,
        description: `Requires ${manage}. 409 while active records still use it.`,
        parameters: [pathParam("id")],
        responses: { 200: success(`${noun} deleted`, { type: "null" }) },
      }),
    },
  };
}

export const catalogPaths: Paths = {
  ...crud("/api/v1/item-categories", "categories", "ItemCategory", "category", "`inventory.manage`"),
  ...crud("/api/v1/brands", "brands", "Brand", "brand", "`inventory.manage`"),
  ...crud("/api/v1/hsn-sac", "hsnSac", "HsnSac", "HSN/SAC code", "`inventory.manage` or `settings.manage`"),
  ...crud(
    "/api/v1/vehicle-makes",
    "vehicleMakes",
    "VehicleMake",
    "vehicle make",
    "`inventory.manage` or `vehicle.manage`",
  ),
  ...crud(
    "/api/v1/vehicle-models",
    "vehicleModels",
    "VehicleModel",
    "vehicle model",
    "`inventory.manage` or `vehicle.manage`",
  ),
};
