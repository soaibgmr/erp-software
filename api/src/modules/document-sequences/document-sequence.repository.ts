import { inject, injectable } from "inversify";
import { PrismaClient } from "@prisma/client";
import { TYPES } from "../../config/ioc.types";
import type { Db } from "../../common/prisma-types";
import type { IDocumentSequenceRepository } from "./interfaces/idocument-sequence.repository";
import type { DocumentSequenceRow, DocumentType } from "./document-sequence.types";

const rowSelect = { docType: true, financialYear: true, prefix: true, padding: true, nextNumber: true } as const;

@injectable()
export class DocumentSequenceRepository implements IDocumentSequenceRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  findForYear(branchId: string, financialYear: number): Promise<DocumentSequenceRow[]> {
    return this.prisma.documentSequence.findMany({ where: { branchId, financialYear }, select: rowSelect });
  }

  findLatestBefore(
    branchId: string,
    docType: DocumentType,
    financialYear: number,
    db: Db = this.prisma,
  ): Promise<DocumentSequenceRow | null> {
    return db.documentSequence.findFirst({
      where: { branchId, docType, financialYear: { lt: financialYear } },
      select: rowSelect,
      orderBy: { financialYear: "desc" },
    });
  }

  async upsertFormat(branchId: string, docType: DocumentType, financialYear: number, prefix: string, padding: number) {
    await this.prisma.documentSequence.upsert({
      where: { branchId_docType_financialYear: { branchId, docType, financialYear } },
      create: { branchId, docType, financialYear, prefix, padding },
      update: { prefix, padding },
    });
  }

  async take(
    db: Db,
    branchId: string,
    docType: DocumentType,
    financialYear: number,
    defaults: { prefix: string; padding: number },
  ) {
    // Create the year's row on first use, then increment. The UPDATE row lock serialises
    // concurrent callers until their transactions finish, so numbers stay gap-free.
    await db.$executeRaw`
      INSERT INTO document_sequences (id, branch_id, doc_type, financial_year, prefix, padding, next_number, updated_at)
      VALUES (gen_random_uuid(), ${branchId}::uuid, ${docType}::document_type, ${financialYear}, ${defaults.prefix}, ${defaults.padding}, 1, now())
      ON CONFLICT (branch_id, doc_type, financial_year) DO NOTHING`;

    const rows = await db.$queryRaw<{ sequence: number; prefix: string; padding: number }[]>`
      UPDATE document_sequences
         SET next_number = next_number + 1, updated_at = now()
       WHERE branch_id = ${branchId}::uuid AND doc_type = ${docType}::document_type AND financial_year = ${financialYear}
   RETURNING next_number - 1 AS sequence, prefix, padding`;
    return rows[0]!;
  }
}
