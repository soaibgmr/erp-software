import { inject, injectable } from "inversify";
import { customerRuleIssues, formatMobile } from "@automobile/shared";
import { TYPES } from "../../config/ioc.types";
import type { AuthContext } from "../../common/auth-context";
import { conflict, fieldErrors, notFound } from "../../common/http-error";
import type { Paginated } from "../../common/pagination";
import type { IAuditService } from "../audit/interfaces/iaudit.service";
import type { ICustomerRepository } from "./interfaces/icustomer.repository";
import type { ICustomerService } from "./interfaces/icustomer.service";
import type { CreateCustomerDto, CustomerResponseDto, ListCustomersQuery, UpdateCustomerDto } from "./customer.types";

@injectable()
export class CustomerService implements ICustomerService {
  constructor(
    @inject(TYPES.CustomerRepository) private readonly customers: ICustomerRepository,
    @inject(TYPES.AuditService) private readonly audit: IAuditService,
  ) {}

  list(query: ListCustomersQuery): Promise<Paginated<CustomerResponseDto>> {
    return this.customers.list(query);
  }

  async getById(id: string): Promise<CustomerResponseDto> {
    const customer = await this.customers.findById(id);
    if (!customer) throw notFound("Customer not found");
    return customer;
  }

  lookupByMobile(mobile: string): Promise<CustomerResponseDto | null> {
    return this.customers.findByMobile(mobile);
  }

  async create(auth: AuthContext, input: CreateCustomerDto): Promise<CustomerResponseDto> {
    await this.assertMobileFree(input.mobile);
    return this.customers.create({ ...input, createdById: auth.userId });
  }

  async update(auth: AuthContext, id: string, input: UpdateCustomerDto): Promise<CustomerResponseDto> {
    const before = await this.getById(id);

    // Cross-field rules run on the record as it will be after the change.
    const issues = customerRuleIssues({
      type: input.type ?? before.type,
      gstin: input.gstin === undefined ? before.gstin : input.gstin,
      stateCode: input.stateCode === undefined ? before.stateCode : input.stateCode,
    });
    if (issues.length) throw fieldErrors(issues);
    if (input.mobile && input.mobile !== before.mobile) await this.assertMobileFree(input.mobile, id);

    const after = await this.customers.update(id, input);
    if (!after) throw notFound("Customer not found");

    // Credit terms decide who can buy on credit, so changes to them are audited.
    if (after.creditLimit !== before.creditLimit || after.creditDays !== before.creditDays) {
      await this.audit.record(auth, {
        action: "customer.credit.update",
        entity: "Customer",
        entityId: id,
        before: { creditLimit: before.creditLimit, creditDays: before.creditDays },
        after: { creditLimit: after.creditLimit, creditDays: after.creditDays },
      });
    }
    return after;
  }

  async remove(auth: AuthContext, id: string): Promise<void> {
    const before = await this.getById(id);
    await this.customers.softDelete(id);
    await this.audit.record(auth, { action: "customer.delete", entity: "Customer", entityId: id, before });
  }

  private async assertMobileFree(mobile: string, excludeId?: string) {
    const existing = await this.customers.findByMobile(mobile, excludeId);
    if (existing) throw conflict(`${formatMobile(mobile)} already belongs to ${existing.name}`);
  }
}
