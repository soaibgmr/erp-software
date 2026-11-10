import { z } from "zod";
import { documentSequenceUpdateSchema, documentTypeSchema } from "@erp-software/shared";

export const listSequencesQuerySchema = z.object({ branchId: z.uuid() });

export const sequenceParamsSchema = z.object({ branchId: z.uuid(), docType: documentTypeSchema });

export { documentSequenceUpdateSchema as updateSequenceSchema };
