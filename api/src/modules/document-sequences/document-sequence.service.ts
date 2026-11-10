import { inject, injectable } from "inversify";
import {
  DOCUMENT_TYPE_DEFAULTS,
  DOCUMENT_TYPES,
  financialYearLabel,
  financialYearStart,
  formatDocumentNumber,
} from "@automobile/shared";
import { TYPES } from "../../config/ioc.types";
import { env } from "../../config/env";
import { canAccessBranch, type AuthContext } from "../../common/auth-context";
import { conflict, forbidden, notFound } from "../../common/http-error";
import type { Db } from "../../common/prisma-types";
import type { IAuditService } from "../audit/interfaces/iaudit.service";
import type { IBranchRepository } from "../branches/interfaces/ibranch.repository";
import type { IDocumentSequenceRepository } from "./interfaces/idocument-sequence.repository";
import type { IDocumentSequenceService } from "./interfaces/idocument-sequence.service";
import type {
  DocumentSequenceResponseDto,
  DocumentSequenceRow,
  DocumentType,
  IssuedNumber,
  UpdateDocumentSequenceDto,
} from "./document-sequence.types";

@injectable()
export class DocumentSequenceService implements IDocumentSequenceService {
  constructor(
    @inject(TYPES.DocumentSequenceRepository) private readonly sequences: IDocumentSequenceRepository,
    @inject(TYPES.BranchRepository) private readonly branches: IBranchRepository,
    @inject(TYPES.AuditService) private readonly audit: IAuditService,
  ) {}

  // Every document type for the current financial year, including series not used yet.
  async list(auth: AuthContext, branchId: string): Promise<DocumentSequenceResponseDto[]> {
    await this.assertBranch(auth, branchId);
    const fy = this.currentYear();
    const rows = await this.sequences.findForYear(branchId, fy);
    return Promise.all(
      DOCUMENT_TYPES.map(async (docType) =>
        toDto(branchId, rows.find((r) => r.docType === docType) ?? (await this.defaultsFor(branchId, docType, fy))),
      ),
    );
  }

  async update(
    auth: AuthContext,
    branchId: string,
    docType: DocumentType,
    { prefix, padding }: UpdateDocumentSequenceDto,
  ): Promise<DocumentSequenceResponseDto> {
    await this.assertBranch(auth, branchId);
    const fy = this.currentYear();
    const before = (await this.sequences.findForYear(branchId, fy)).find((r) => r.docType === docType);
    if (before && before.nextNumber > 1) {
      throw conflict(
        `Numbers have already been issued in this series for ${financialYearLabel(fy)}. The format can change from the next financial year.`,
      );
    }

    await this.sequences.upsertFormat(branchId, docType, fy, prefix, padding);
    const after: DocumentSequenceRow = { docType, financialYear: fy, prefix, padding, nextNumber: 1 };
    await this.audit.record(auth, {
      action: "sequence.update",
      entity: "DocumentSequence",
      entityId: `${branchId}:${docType}:${fy}`,
      branchId,
      before,
      after,
    });
    return toDto(branchId, after);
  }

  async next(db: Db, branchId: string, docType: DocumentType, at = new Date()): Promise<IssuedNumber> {
    const fy = financialYearStart(at, env.APP_TIMEZONE);
    // Everything here runs on the caller's transaction: a second pooled connection inside a
    // transaction can starve the pool when many charges run at once.
    const defaults = await this.defaultsFor(branchId, docType, fy, db);
    const { sequence, prefix, padding } = await this.sequences.take(db, branchId, docType, fy, defaults);
    return { number: formatDocumentNumber(prefix, fy, sequence, padding), sequence, financialYear: fy };
  }

  private currentYear() {
    return financialYearStart(new Date(), env.APP_TIMEZONE);
  }

  // A new financial year keeps last year's prefix and padding, and restarts at 1.
  private async defaultsFor(
    branchId: string,
    docType: DocumentType,
    fy: number,
    db?: Db,
  ): Promise<DocumentSequenceRow> {
    const previous = await this.sequences.findLatestBefore(branchId, docType, fy, db);
    const d = DOCUMENT_TYPE_DEFAULTS[docType];
    return {
      docType,
      financialYear: fy,
      prefix: previous?.prefix ?? d.prefix,
      padding: previous?.padding ?? d.padding,
      nextNumber: 1,
    };
  }

  private async assertBranch(auth: AuthContext, branchId: string) {
    if (!canAccessBranch(auth, branchId)) throw forbidden("You don't have access to this branch");
    if (!(await this.branches.findById(branchId))) throw notFound("Branch not found");
  }
}

const toDto = (branchId: string, row: DocumentSequenceRow): DocumentSequenceResponseDto => ({
  ...row,
  branchId,
  label: DOCUMENT_TYPE_DEFAULTS[row.docType].label,
  financialYearLabel: financialYearLabel(row.financialYear),
  preview: formatDocumentNumber(row.prefix, row.financialYear, row.nextNumber, row.padding),
  inUse: row.nextNumber > 1,
});
