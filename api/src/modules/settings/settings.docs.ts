import { posSettingsSchema, printSettingsSchema, SETTINGS_GROUPS, taxSettingsSchema } from "@automobile/shared";
import { fromZod, operation, type Paths, ref, type SchemaObject, success } from "../../docs/openapi.helpers";

export const settingsSchemas: Record<string, SchemaObject> = {
  TaxSettings: fromZod(taxSettingsSchema),
  PrintSettings: fromZod(printSettingsSchema),
  PosSettings: fromZod(posSettingsSchema),
  AllSettings: {
    type: "object",
    properties: { tax: ref("TaxSettings"), print: ref("PrintSettings"), pos: ref("PosSettings") },
  },
};

const groupParam = {
  name: "group",
  in: "path",
  required: true,
  schema: { type: "string", enum: [...SETTINGS_GROUPS] },
};
const anyGroup = { oneOf: [ref("TaxSettings"), ref("PrintSettings"), ref("PosSettings")] };

export const settingsPaths: Paths = {
  "/api/v1/settings": {
    get: operation({
      tag: "Settings",
      summary: "All settings groups",
      description: "Stored values merged over defaults.",
      responses: { 200: success("Settings", ref("AllSettings")) },
    }),
  },
  "/api/v1/settings/{group}": {
    get: operation({
      tag: "Settings",
      summary: "One settings group",
      parameters: [groupParam],
      responses: { 200: success("Settings group", anyGroup) },
    }),
    patch: operation({
      tag: "Settings",
      summary: "Update a settings group",
      description: "Requires `settings.manage`. Send only the fields to change; the body follows the group's schema.",
      parameters: [groupParam],
      body: anyGroup,
      responses: { 200: success("Settings saved", anyGroup) },
    }),
  },
};
