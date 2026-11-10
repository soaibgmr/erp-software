import type { Paginated } from "../../../common/pagination";
import type { CreateCustomerData, CustomerResponseDto, ListCustomersQuery, UpdateCustomerDto } from "../customer.types";

export interface ICustomerRepository {
  findById(id: string): Promise<CustomerResponseDto | null>;
  // Active (non-deleted) customer with this mobile.
  findByMobile(mobile: string, excludeId?: string): Promise<CustomerResponseDto | null>;
  list(query: ListCustomersQuery): Promise<Paginated<CustomerResponseDto>>;
  create(data: CreateCustomerData): Promise<CustomerResponseDto>;
  update(id: string, data: UpdateCustomerDto): Promise<CustomerResponseDto | null>;
  softDelete(id: string): Promise<boolean>;
}
