import type { LabourServiceCreate, LabourServiceUpdate } from "@erp-software/shared";

export type CreateLabourServiceDto = LabourServiceCreate;
export type UpdateLabourServiceDto = LabourServiceUpdate;

export interface LabourServiceResponseDto {
  id: string;
  code: string | null;
  name: string;
  sacCode: string;
  gstRate: number;
  // Decimal strings: "1450.00", "1.50".
  rate: string;
  standardHours: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListLabourServicesQuery {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
}
