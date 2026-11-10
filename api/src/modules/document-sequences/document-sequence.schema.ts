import { z } from "zod";
import { documentSequenceUpdateSchema, documentTypeSchema } from "@automobile/shared";

export const listSequencesQuerySchema = z.object({ branchId: z.uuid() });

export const sequenceParamsSchema = z.object({ branchId: z.uuid(), docType: documentTypeSchema });

export { documentSequenceUpdateSchema as updateSequenceSchema };
