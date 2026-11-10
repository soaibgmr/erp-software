import { Router } from "express";
import { container } from "../../config/inversify.config";
import { TYPES } from "../../config/ioc.types";
import type { AuthMiddleware } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import type { DocumentSequenceController } from "./document-sequence.controller";
import { listSequencesQuerySchema, sequenceParamsSchema, updateSequenceSchema } from "./document-sequence.schema";

const controller = container.get<DocumentSequenceController>(TYPES.DocumentSequenceController);
const { requireAuth, requirePermission } = container.get<AuthMiddleware>(TYPES.AuthMiddleware);

export const documentSequencesRouter = Router();

documentSequencesRouter.use(requireAuth, requirePermission("settings.manage"));

documentSequencesRouter.get("/", validate({ query: listSequencesQuerySchema }), controller.list);
documentSequencesRouter.patch(
  "/:branchId/:docType",
  validate({ params: sequenceParamsSchema, body: updateSequenceSchema }),
  controller.update,
);
