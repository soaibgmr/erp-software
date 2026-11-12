import { idParamSchema } from "../../common/schemas";

export { scanEventCreateSchema, scanPollQuerySchema } from "@erp-software/shared";
export const scanSessionParamSchema = idParamSchema;

// The phone sends the token from the QR code in this header (never in the URL).
export const SCAN_TOKEN_HEADER = "x-scan-token";
