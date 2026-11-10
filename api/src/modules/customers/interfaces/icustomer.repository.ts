import type { Paginated } from "../../../common/pagination";
import type { CreateCustomerData, CustomerResponseDto, ListCustomersQuery, UpdateCustomerDto } from "../customer.types";

// Customers belong to one business and are shared by its branches.
export interface ICustomerRepository {
  findById(businessId: string, id: string): Promise<CustomerResponseDto | null>;
  // Active (non-deleted) customer of this business with this mobile.
  findByMobile(businessId: string, mobile: string, excludeId?: string): Promise<CustomerResponseDto | null>;
  // Oldest active customer of this business with this email (emails aren't unique among customers).
  findByEmail(businessId: string, email: string): Promise<CustomerResponseDto | null>;
  list(businessId: string, query: ListCustomersQuery): Promise<Paginated<CustomerResponseDto>>;
  create(businessId: string, data: CreateCustomerData): Promise<CustomerResponseDto>;
  update(businessId: string, id: string, data: UpdateCustomerDto): Promise<CustomerResponseDto | null>;
  softDelete(businessId: string, id: string): Promise<boolean>;
}
