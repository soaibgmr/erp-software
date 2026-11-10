import {
  ITEM_UNITS,
  STOCK_ADJUSTMENT_REASONS,
  STOCK_ADJUSTMENT_STATUSES,
  STOCK_MOVEMENT_TYPES,
  STOCK_TRANSFER_STATUSES,
} from "@erp-software/shared";
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
  createAdjustmentSchema,
  createTransferSchema,
  importSchema,
  ledgerQuerySchema,
  listAdjustmentsQuerySchema,
  listStockQuerySchema,
  listTransfersQuerySchema,
  rejectAdjustmentSchema,
  updateStockSettingsSchema,
} from "./stock.schema";

const s = { type: ["string", "null"] };
const str = { type: "string" };
const uuid = { type: "string", format: "uuid" };
const userRef = { type: ["object", "null"], properties: { id: uuid, name: str } };
const branchRef = { type: "object", properties: { id: uuid, code: str, name: str } };
const lineItem = {
  itemId: uuid,
  sku: str,
  name: str,
  unit: { type: "string", enum: [...ITEM_UNITS] },
  quantity: str,
  unitCost: str,
};

export const stockSchemas: Record<string, SchemaObject> = {
  StockRow: {
    allOf: [
      ref("ItemStock"),
      {
        type: "object",
        properties: {
          itemId: uuid,
          sku: str,
          name: str,
          oemPartNo: s,
          unit: { type: "string", enum: [...ITEM_UNITS] },
          brandName: s,
          categoryName: s,
          salePrice: str,
          purchasePrice: str,
          branchCode: str,
          branchName: str,
        },
      },
    ],
  },
  LedgerEntry: {
    type: "object",
    properties: {
      id: uuid,
      type: { type: "string", enum: [...STOCK_MOVEMENT_TYPES] },
      quantity: { type: "string", example: "-2.000" },
      balanceAfter: { type: "string", example: "10.000" },
      unitCost: s,
      refType: s,
      refId: s,
      refNo: s,
      note: s,
      createdAt: { type: "string", format: "date-time" },
      createdBy: userRef,
    },
  },
  StockAdjustment: {
    type: "object",
    properties: {
      id: uuid,
      number: { type: "string", example: "ADJ-26-00012" },
      branchId: uuid,
      reason: { type: "string", enum: [...STOCK_ADJUSTMENT_REASONS] },
      note: s,
      status: { type: "string", enum: [...STOCK_ADJUSTMENT_STATUSES] },
      totalValue: { type: "string", example: "3600.00" },
      lineCount: { type: "integer" },
      createdBy: userRef,
      decidedBy: userRef,
      decidedAt: { type: ["string", "null"], format: "date-time" },
      decisionNote: s,
      createdAt: { type: "string", format: "date-time" },
      lines: {
        type: "array",
        items: { type: "object", properties: { ...lineItem, value: str } },
        description: "Detail responses only.",
      },
    },
  },
  StockTransfer: {
    type: "object",
    properties: {
      id: uuid,
      number: { type: "string", example: "STR-26-00003" },
      status: { type: "string", enum: [...STOCK_TRANSFER_STATUSES] },
      fromBranch: branchRef,
      toBranch: branchRef,
      note: s,
      lineCount: { type: "integer" },
      totalQuantity: str,
      createdBy: userRef,
      closedBy: userRef,
      closedAt: { type: ["string", "null"], format: "date-time" },
      createdAt: { type: "string", format: "date-time" },
      lines: { type: "array", items: { type: "object", properties: lineItem }, description: "Detail responses only." },
    },
  },
  ImportReport: {
    type: "object",
    properties: {
      committed: { type: "boolean" },
      total: { type: "integer" },
      errorCount: { type: "integer" },
      createCount: { type: "integer" },
      updateCount: { type: "integer" },
      skipCount: { type: "integer" },
      openingStockCount: { type: "integer" },
      newBrands: { type: "array", items: str },
      newCategories: { type: "array", items: str },
      unknownColumns: { type: "array", items: str },
      rows: {
        type: "array",
        items: {
          type: "object",
          properties: {
            row: { type: "integer" },
            sku: str,
            name: str,
            action: { type: "string", enum: ["create", "update", "skip", "error"] },
            openingQty: s,
            errors: { type: "array", items: str },
            warnings: { type: "array", items: str },
          },
        },
      },
    },
  },
};

const tag = "Stock";
const branch = "Acts on the `x-branch-id` branch.";

export const stockPaths: Paths = {
  "/api/v1/stock": {
    get: operation({
      tag,
      summary: "Stock levels",
      description:
        "Requires `inventory.view` or `inventory.manage`. One branch (header or `branchId`) lists every active item, zero-filled; " +
        "`branchId=all` lists stocked rows in every branch you can access. `status=LOW` = min level set and available ≤ min (includes out of stock).",
      parameters: queryParams(listStockQuerySchema),
      responses: { 200: success("Stock rows", { type: "array", items: ref("StockRow") }, { paginated: true }) },
    }),
  },
  "/api/v1/stock/{itemId}/ledger": {
    get: operation({
      tag,
      summary: "Item stock ledger",
      description: "Append-only movements for one item in one branch, newest first.",
      parameters: [pathParam("itemId"), ...queryParams(ledgerQuerySchema)],
      responses: { 200: success("Ledger", { type: "array", items: ref("LedgerEntry") }, { paginated: true }) },
    }),
  },
  "/api/v1/stock/{itemId}/settings": {
    patch: operation({
      tag,
      summary: "Min level, reorder qty and bin for a branch",
      description: `Requires \`inventory.manage\`. ${branch}`,
      parameters: [pathParam("itemId")],
      body: fromZod(updateStockSettingsSchema),
      responses: { 200: success("Stock", ref("ItemStock")) },
    }),
  },
  "/api/v1/stock/adjustments": {
    get: operation({
      tag,
      summary: "List stock adjustments",
      description: branch,
      parameters: queryParams(listAdjustmentsQuerySchema),
      responses: { 200: success("Adjustments", { type: "array", items: ref("StockAdjustment") }, { paginated: true }) },
    }),
    post: operation({
      tag,
      summary: "Create a stock adjustment",
      description:
        `Requires \`inventory.manage\`. ${branch} Signed quantities. Posts at once, or stays PENDING when its value at purchase price ` +
        "exceeds the inventory setting `adjustmentApprovalLimit` and the user lacks `stock.approve`. 409 if it would make stock negative.",
      body: fromZod(createAdjustmentSchema),
      responses: { 201: success("Adjustment", ref("StockAdjustment")) },
    }),
  },
  "/api/v1/stock/adjustments/{id}": {
    get: operation({
      tag,
      summary: "Get a stock adjustment",
      parameters: [pathParam("id")],
      responses: { 200: success("Adjustment", ref("StockAdjustment")) },
    }),
  },
  "/api/v1/stock/adjustments/{id}/approve": {
    post: operation({
      tag,
      summary: "Approve and post a pending adjustment",
      description: `Requires \`stock.approve\`. ${branch}`,
      parameters: [pathParam("id")],
      responses: { 200: success("Adjustment", ref("StockAdjustment")) },
    }),
  },
  "/api/v1/stock/adjustments/{id}/reject": {
    post: operation({
      tag,
      summary: "Reject a pending adjustment",
      description: `Requires \`stock.approve\`. ${branch}`,
      parameters: [pathParam("id")],
      body: fromZod(rejectAdjustmentSchema),
      responses: { 200: success("Adjustment", ref("StockAdjustment")) },
    }),
  },
  "/api/v1/stock/transfers": {
    get: operation({
      tag,
      summary: "List transfers in or out of the branch",
      description: branch,
      parameters: queryParams(listTransfersQuerySchema),
      responses: { 200: success("Transfers", { type: "array", items: ref("StockTransfer") }, { paginated: true }) },
    }),
    post: operation({
      tag,
      summary: "Dispatch a transfer",
      description: `Requires \`inventory.manage\`. ${branch} Stock leaves now and shows as in transit at the receiver. Never allows negative stock.`,
      body: fromZod(createTransferSchema),
      responses: { 201: success("Transfer", ref("StockTransfer")) },
    }),
  },
  "/api/v1/stock/transfers/{id}": {
    get: operation({
      tag,
      summary: "Get a transfer",
      parameters: [pathParam("id")],
      responses: { 200: success("Transfer", ref("StockTransfer")) },
    }),
  },
  "/api/v1/stock/transfers/{id}/receive": {
    post: operation({
      tag,
      summary: "Receive a transfer",
      description: "Requires `inventory.manage`; `x-branch-id` must be the receiving branch.",
      parameters: [pathParam("id")],
      responses: { 200: success("Transfer", ref("StockTransfer")) },
    }),
  },
  "/api/v1/stock/transfers/{id}/cancel": {
    post: operation({
      tag,
      summary: "Cancel a transfer in transit",
      description: "Requires `inventory.manage`; `x-branch-id` must be the sending branch. Stock returns to it.",
      parameters: [pathParam("id")],
      responses: { 200: success("Transfer", ref("StockTransfer")) },
    }),
  },
  "/api/v1/stock/import": {
    post: operation({
      tag,
      summary: "Import items and opening stock",
      description:
        `Requires \`inventory.manage\`. ${branch} Rows are CSV records keyed by header (sku, name, salePrice required). ` +
        "`commit=false` returns a per-row report; `commit=true` writes everything in one transaction and is refused while any row has errors. " +
        "Opening quantity is only posted for items with no stock history in the branch.",
      body: fromZod(importSchema),
      responses: { 200: success("Report", ref("ImportReport")) },
    }),
  },
};
