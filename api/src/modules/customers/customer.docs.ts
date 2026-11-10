import { CUSTOMER_TYPES } from "@automobile/shared";
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
  createCustomerSchema,
  listCustomersQuerySchema,
  lookupCustomerQuerySchema,
  updateCustomerSchema,
} from "./customer.schema";

const s = { type: ["string", "null"] };

export const customerSchemas: Record<string, SchemaObject> = {
  Customer: {
    type: "object",
    required: ["id", "type", "name", "mobile", "creditLimit", "creditDays"],
    properties: {
      id: { type: "string", format: "uuid" },
      type: { type: "string", enum: [...CUSTOMER_TYPES] },
      name: { type: "string", example: "Rakesh Menon" },
      mobile: { type: "string", example: "9847012345" },
      alternatePhone: s,
      email: s,
      address: s,
      city: s,
      pincode: s,
      stateCode: { ...s, description: "Place of supply; null = branch state." },
      gstin: s,
      creditLimit: { type: "string", example: "50000.00" },
      creditDays: { type: "integer" },
      notes: s,
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
};

const tag = "Customers";
const manage = "Requires `customer.manage`.";

export const customerPaths: Paths = {
  "/api/v1/customers": {
    get: operation({
      tag,
      summary: "List customers",
      description: "`search` matches name, mobile (3+ digits), GSTIN prefix or city.",
      parameters: queryParams(listCustomersQuerySchema),
      responses: { 200: success("Customers", { type: "array", items: ref("Customer") }, { paginated: true }) },
    }),
    post: operation({
      tag,
      summary: "Create a customer",
      description: `${manage} Mobile must be unique among active customers (409). B2B needs a GSTIN.`,
      body: fromZod(createCustomerSchema),
      responses: { 201: success("Customer created", ref("Customer")) },
    }),
  },
  "/api/v1/customers/lookup": {
    get: operation({
      tag,
      summary: "Find a customer by mobile",
      description: "Returns `data: null` when no active customer has the number.",
      parameters: queryParams(lookupCustomerQuerySchema),
      responses: { 200: success("Customer or null", { oneOf: [ref("Customer"), { type: "null" }] }) },
    }),
  },
  "/api/v1/customers/{id}": {
    get: operation({
      tag,
      summary: "Get a customer",
      parameters: [pathParam("id")],
      responses: { 200: success("Customer", ref("Customer")) },
    }),
    patch: operation({
      tag,
      summary: "Update a customer",
      description: `${manage} Credit limit and credit day changes are audited.`,
      parameters: [pathParam("id")],
      body: fromZod(updateCustomerSchema),
      responses: { 200: success("Customer updated", ref("Customer")) },
    }),
    delete: operation({
      tag,
      summary: "Soft-delete a customer",
      description: manage,
      parameters: [pathParam("id")],
      responses: { 200: success("Customer deleted", { type: "null" }) },
    }),
  },
};
