import type { AuthContext } from "../../../common/auth-context";
import type { Db } from "../../../common/prisma-types";
import type {
  DocumentSequenceResponseDto,
  DocumentType,
  IssuedNumber,
  UpdateDocumentSequenceDto,
} from "../document-sequence.types";

export interface IDocumentSequenceService {
  list(auth: AuthContext, branchId: string): Promise<DocumentSequenceResponseDto[]>;
  update(
    auth: AuthContext,
    branchId: string,
    docType: DocumentType,
    input: UpdateDocumentSequenceDto,
  ): Promise<DocumentSequenceResponseDto>;
  // Call inside the transaction that creates the document so a rollback releases the number.
  next(db: Db, branchId: string, docType: DocumentType, at?: Date): Promise<IssuedNumber>;
}
