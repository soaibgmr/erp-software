import { businessUpdateSchema } from "@erp-software/shared";
import { fromZod, operation, type Paths, ref, type SchemaObject, success } from "../../docs/openapi.helpers";

const s = { type: ["string", "null"] };

export const businessSchemas: Record<string, SchemaObject> = {
  Business: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      legalName: { type: "string" },
      tradeName: s,
      address: s,
      city: s,
      pincode: s,
      stateCode: { type: "string", example: "32" },
      gstin: s,
      phone: s,
      email: s,
      website: s,
      bankName: s,
      bankAccountNo: s,
      bankIfsc: s,
      upiId: s,
      updatedAt: { type: "string", format: "date-time" },
    },
  },
};

export const businessPaths: Paths = {
  "/api/v1/business": {
    get: operation({
      tag: "Business",
      summary: "Get the business profile",
      responses: { 200: success("Business profile", ref("Business")) },
    }),
    patch: operation({
      tag: "Business",
      summary: "Update the business profile",
      description: "Requires `settings.manage`. The GSTIN must belong to the chosen state.",
      body: fromZod(businessUpdateSchema),
      responses: { 200: success("Business profile updated", ref("Business")) },
    }),
  },
};
