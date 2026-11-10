import type { AuthContext } from "../../../common/auth-context";
import type { Paginated } from "../../../common/pagination";
import type { CreateCustomerDto, CustomerResponseDto, ListCustomersQuery, UpdateCustomerDto } from "../customer.types";

export interface ICustomerService {
  list(auth: AuthContext, query: ListCustomersQuery): Promise<Paginated<CustomerResponseDto>>;
  getById(auth: AuthContext, id: string): Promise<CustomerResponseDto>;
  // Mobile number, or email when it contains "@".
  lookup(auth: AuthContext, identifier: string): Promise<CustomerResponseDto | null>;
  create(auth: AuthContext, input: CreateCustomerDto): Promise<CustomerResponseDto>;
  update(auth: AuthContext, id: string, input: UpdateCustomerDto): Promise<CustomerResponseDto>;
  remove(auth: AuthContext, id: string): Promise<void>;
}
