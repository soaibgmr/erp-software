import type { BusinessUpdate } from "@erp-software/shared";

export type UpdateBusinessDto = BusinessUpdate;

export interface BusinessResponseDto {
  id: string;
  legalName: string;
  tradeName: string | null;
  address: string | null;
  city: string | null;
  pincode: string | null;
  stateCode: string;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankIfsc: string | null;
  upiId: string | null;
  updatedAt: Date;
}
