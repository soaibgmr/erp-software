import type { CustomerCreate, CustomerType, CustomerUpdate } from "@automobile/shared";

export type CreateCustomerDto = CustomerCreate;
export type UpdateCustomerDto = CustomerUpdate;

export interface CustomerResponseDto {
  id: string;
  type: CustomerType;
  name: string;
  mobile: string;
  alternatePhone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  pincode: string | null;
  stateCode: string | null;
  gstin: string | null;
  // Decimal as a string with 2 places, e.g. "50000.00".
  creditLimit: string;
  creditDays: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListCustomersQuery {
  page: number;
  limit: number;
  search?: string;
  type?: CustomerType;
  sort: "name" | "recent";
}

export interface CreateCustomerData extends CreateCustomerDto {
  createdById: string;
}
