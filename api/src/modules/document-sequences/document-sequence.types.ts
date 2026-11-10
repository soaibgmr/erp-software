import type { DocumentSequenceUpdate, DocumentType } from "@automobile/shared";

export type { DocumentType };
export type UpdateDocumentSequenceDto = DocumentSequenceUpdate;

export interface DocumentSequenceRow {
  docType: DocumentType;
  financialYear: number;
  prefix: string;
  padding: number;
  nextNumber: number;
}

export interface DocumentSequenceResponseDto extends DocumentSequenceRow {
  branchId: string;
  label: string;
  financialYearLabel: string;
  // The number the next document will get, e.g. INV-26-00001.
  preview: string;
  // True once a number has been issued; the format is then locked for this financial year.
  inUse: boolean;
}

export interface IssuedNumber {
  number: string;
  sequence: number;
  financialYear: number;
}
