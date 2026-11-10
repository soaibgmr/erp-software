import { ITEM_UNITS } from "@automobile/shared";
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
import { createItemSchema, listItemsQuerySchema, searchItemsQuerySchema, updateItemSchema } from "./item.schema";

const s = { type: ["string", "null"] };
const qty = (example: string) => ({ type: "string", example, description: "Decimal with 3 places" });
const named = {
  type: ["object", "null"],
  properties: { id: { type: "string", format: "uuid" }, name: { type: "string" } },
};

export const itemSchemas: Record<string, SchemaObject> = {
  ItemStock: {
    type: "object",
    properties: {
      branchId: { type: "string", format: "uuid" },
      onHand: qty("12.000"),
      reserved: qty("2.000"),
      available: qty("10.000"),
      inTransit: qty("0.000"),
      minLevel: qty("5.000"),
      reorderQty: qty("20.000"),
      binLocation: s,
      status: { type: "string", enum: ["IN_STOCK", "LOW", "OUT"] },
    },
  },
  Item: {
    type: "object",
    required: [
      "id",
      "sku",
      "name",
      "gstRate",
      "unit",
      "salePrice",
      "purchasePrice",
      "taxInclusive",
      "isActive",
      "barcodes",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      sku: { type: "string", example: "OF-BSH-2341" },
      name: { type: "string", example: "Oil filter - Swift" },
      oemPartNo: s,
      description: s,
      category: named,
      brand: named,
      hsnCode: s,
      gstRate: { type: "number", example: 18 },
      unit: { type: "string", enum: [...ITEM_UNITS] },
      mrp: { ...s, example: "450.00" },
      salePrice: { type: "string", example: "295.00" },
      purchasePrice: { type: "string", example: "180.00" },
      taxInclusive: { type: "boolean" },
      isActive: { type: "boolean" },
      barcodes: { type: "array", items: { type: "string" } },
      compatibleModels: {
        type: "array",
        items: {
          type: "object",
          properties: { id: { type: "string" }, name: { type: "string" }, makeName: { type: "string" } },
        },
      },
      stock: {
        oneOf: [ref("ItemStock"), { type: "null" }],
        description: "For the x-branch-id branch; null without the header.",
      },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  ItemDetail: {
    allOf: [
      ref("Item"),
      {
        type: "object",
        properties: {
          stockByBranch: {
            type: "array",
            items: {
              allOf: [
                ref("ItemStock"),
                { type: "object", properties: { branchCode: { type: "string" }, branchName: { type: "string" } } },
              ],
            },
          },
        },
      },
    ],
  },
  ItemSearchResult: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      sku: { type: "string" },
      name: { type: "string" },
      oemPartNo: s,
      brandName: s,
      hsnCode: s,
      gstRate: { type: "number" },
      unit: { type: "string", enum: [...ITEM_UNITS] },
      mrp: s,
      salePrice: { type: "string" },
      taxInclusive: { type: "boolean" },
      exact: { type: "boolean", description: "Matched an exact SKU, OEM number or barcode." },
      stock: {
        type: ["object", "null"],
        properties: {
          onHand: qty("12.000"),
          reserved: qty("0.000"),
          available: qty("12.000"),
          status: { type: "string" },
        },
      },
    },
  },
};

const tag = "Items";
const view =
  "Requires `inventory.view`, `inventory.manage` or `pos.use`. Send `x-branch-id` to get stock for that branch.";

export const itemPaths: Paths = {
  "/api/v1/items": {
    get: operation({
      tag,
      summary: "List items",
      description: `${view} \`search\` matches an exact SKU/OEM/barcode, or every word against name, SKU, OEM number and brand.`,
      parameters: queryParams(listItemsQuerySchema),
      responses: { 200: success("Items", { type: "array", items: ref("Item") }, { paginated: true }) },
    }),
    post: operation({
      tag,
      summary: "Create an item",
      description:
        "Requires `inventory.manage`. SKU and barcodes must be unique among active items; price with GST can't exceed MRP.",
      body: fromZod(createItemSchema),
      responses: { 201: success("Item created", ref("ItemDetail")) },
    }),
  },
  "/api/v1/items/search": {
    get: operation({
      tag,
      summary: "Fast part search (POS)",
      description: `${view} Active items only; exact code matches first.`,
      parameters: queryParams(searchItemsQuerySchema),
      responses: { 200: success("Matches", { type: "array", items: ref("ItemSearchResult") }) },
    }),
  },
  "/api/v1/items/by-barcode/{code}": {
    get: operation({
      tag,
      summary: "Find an item by barcode or SKU",
      description: `${view} 404 when nothing matches (the POS then offers search).`,
      parameters: [pathParam("code", { type: "string" })],
      responses: { 200: success("Item", ref("ItemSearchResult")) },
    }),
  },
  "/api/v1/items/{id}": {
    get: operation({
      tag,
      summary: "Get an item with stock per branch",
      description: view,
      parameters: [pathParam("id")],
      responses: { 200: success("Item", ref("ItemDetail")) },
    }),
    patch: operation({
      tag,
      summary: "Update an item",
      description:
        "Requires `inventory.manage`. `barcodes` / `compatibleModelIds` replace the whole set when sent. Price and tax changes are audited.",
      parameters: [pathParam("id")],
      body: fromZod(updateItemSchema),
      responses: { 200: success("Item updated", ref("ItemDetail")) },
    }),
    delete: operation({
      tag,
      summary: "Soft-delete an item",
      description: "Requires `inventory.manage`. 409 while any branch has on-hand, reserved or in-transit quantity.",
      parameters: [pathParam("id")],
      responses: { 200: success("Item deleted", { type: "null" }) },
    }),
  },
};
