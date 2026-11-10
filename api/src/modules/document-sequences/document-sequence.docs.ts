import { DOCUMENT_TYPES } from "@erp-software/shared";
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
import { listSequencesQuerySchema, updateSequenceSchema } from "./document-sequence.schema";

export const documentSequenceSchemas: Record<string, SchemaObject> = {
  DocumentSequence: {
    type: "object",
    properties: {
      branchId: { type: "string", format: "uuid" },
      docType: { type: "string", enum: [...DOCUMENT_TYPES] },
      label: { type: "string", example: "Tax invoice" },
      financialYear: { type: "integer", example: 2026 },
      financialYearLabel: { type: "string", example: "2026-27" },
      prefix: { type: "string", example: "INV" },
      padding: { type: "integer", example: 5 },
      nextNumber: { type: "integer" },
      preview: { type: "string", example: "INV-26-00001" },
      inUse: { type: "boolean", description: "Numbers were issued; the format is locked for this financial year." },
    },
  },
};

const tag = "Number series";

export const documentSequencePaths: Paths = {
  "/api/v1/document-sequences": {
    get: operation({
      tag,
      summary: "Number series of a branch for the current financial year",
      description: "Requires `settings.manage` and access to the branch.",
      parameters: queryParams(listSequencesQuerySchema),
      responses: { 200: success("Number series", { type: "array", items: ref("DocumentSequence") }) },
    }),
  },
  "/api/v1/document-sequences/{branchId}/{docType}": {
    patch: operation({
      tag,
      summary: "Change the prefix and padding of a series",
      description: "Only before the first number of the financial year is issued (409 afterwards).",
      parameters: [
        pathParam("branchId"),
        { name: "docType", in: "path", required: true, schema: { type: "string", enum: [...DOCUMENT_TYPES] } },
      ],
      body: fromZod(updateSequenceSchema),
      responses: { 200: success("Number series updated", ref("DocumentSequence")) },
    }),
  },
};
