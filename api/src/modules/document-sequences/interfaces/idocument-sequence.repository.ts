import type { Db } from "../../../common/prisma-types";
import type { DocumentSequenceRow, DocumentType } from "../document-sequence.types";

export interface IDocumentSequenceRepository {
  findForYear(branchId: string, financialYear: number): Promise<DocumentSequenceRow[]>;
  // Most recent series for the type before `financialYear`, used to carry the prefix forward.
  findLatestBefore(
    branchId: string,
    docType: DocumentType,
    financialYear: number,
    db?: Db,
  ): Promise<DocumentSequenceRow | null>;
  upsertFormat(
    branchId: string,
    docType: DocumentType,
    financialYear: number,
    prefix: string,
    padding: number,
  ): Promise<void>;
  // Atomically takes the next number (row lock held until the caller's transaction ends).
  take(
    db: Db,
    branchId: string,
    docType: DocumentType,
    financialYear: number,
    defaults: { prefix: string; padding: number },
  ): Promise<{ sequence: number; prefix: string; padding: number }>;
}
