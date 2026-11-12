import { fromZod, operation, pathParam, type Paths, queryParams, ref, success } from "../../docs/openapi.helpers";
import { scanEventCreateSchema, scanPollQuerySchema } from "./pos-scanner.schema";

const tag = "Phone scanner";
const branch = "Uses the `x-branch-id` header.";
const tokenNote =
  "No login: send the token from the QR code in the `x-scan-token` header. 410 `SCAN_SESSION_ENDED` once the PC ends it or it expires (12 h).";

export const posScannerSchemas = {
  ScanSessionCreated: {
    type: "object",
    required: ["id", "token", "expiresAt"],
    properties: {
      id: { type: "string", format: "uuid" },
      token: { type: "string", description: "Shown once; put it in the QR code." },
      expiresAt: { type: "string", format: "date-time" },
    },
  },
  ScanPoll: {
    type: "object",
    required: ["scans", "phoneConnected", "closed"],
    properties: {
      scans: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "code"],
          properties: { id: { type: "string", description: "Cursor for `after`" }, code: { type: "string" } },
        },
      },
      phoneConnected: { type: "boolean" },
      closed: { type: "boolean" },
    },
  },
  ScanSessionInfo: {
    type: "object",
    required: ["shopName", "branchName"],
    properties: { shopName: { type: "string" }, branchName: { type: "string" } },
  },
  ScanResult: {
    type: "object",
    required: ["found", "name", "salePrice"],
    properties: {
      found: { type: "boolean" },
      name: { type: ["string", "null"] },
      salePrice: { type: ["string", "null"] },
    },
  },
};

export const posScannerPaths: Paths = {
  "/api/v1/pos/scan-sessions": {
    post: operation({
      tag,
      summary: "Pair a phone as a barcode scanner",
      description: `${branch} Ends this user's previous phone scanner in the branch. The UI shows a QR code with the id and token.`,
      responses: { 201: success("Phone scanner", ref("ScanSessionCreated")) },
    }),
  },
  "/api/v1/pos/scan-sessions/{id}/scans": {
    get: operation({
      tag,
      summary: "Scans from the phone (poll)",
      description: "Returns up to 50 scans after `after`, oldest first. Poll about once a second.",
      parameters: [pathParam("id"), ...queryParams(scanPollQuerySchema)],
      responses: { 200: success("Scans", ref("ScanPoll")) },
    }),
  },
  "/api/v1/pos/scan-sessions/{id}": {
    delete: operation({
      tag,
      summary: "End the phone scanner",
      parameters: [pathParam("id")],
      responses: { 200: success("Ended", { type: "null" }) },
    }),
  },
  "/api/v1/scan-sessions/{id}/ping": {
    post: operation({
      tag,
      summary: "Phone: connect (public)",
      description: tokenNote,
      auth: "client",
      parameters: [pathParam("id")],
      responses: { 200: success("Shop and branch", ref("ScanSessionInfo")) },
    }),
  },
  "/api/v1/scan-sessions/{id}/scans": {
    post: operation({
      tag,
      summary: "Phone: send a scanned barcode (public)",
      description: `${tokenNote} The answer says whether the code matches an item, for the phone to show.`,
      auth: "client",
      parameters: [pathParam("id")],
      body: fromZod(scanEventCreateSchema),
      responses: { 200: success("Scan result", ref("ScanResult")) },
    }),
  },
};
