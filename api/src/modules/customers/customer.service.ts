import { inject, injectable } from "inversify";
import { customerRuleIssues, formatMobile } from "@erp-software/shared";
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

  list(auth: AuthContext, query: ListCustomersQuery): Promise<Paginated<CustomerResponseDto>> {
    return this.customers.list(auth.businessId, query);
  }

  async getById(auth: AuthContext, id: string): Promise<CustomerResponseDto> {
    const customer = await this.customers.findById(auth.businessId, id);
    if (!customer) throw notFound("Customer not found");
    return customer;
  }

  // The POS finds the customer by what they tell the cashier: a mobile number or an email.
  lookup(auth: AuthContext, identifier: string): Promise<CustomerResponseDto | null> {
    return identifier.includes("@")
      ? this.customers.findByEmail(auth.businessId, identifier)
      : this.customers.findByMobile(auth.businessId, identifier);
  }

  async create(auth: AuthContext, input: CreateCustomerDto): Promise<CustomerResponseDto> {
    await this.assertMobileFree(auth, input.mobile);
    return this.customers.create(auth.businessId, { ...input, createdById: auth.userId });
  }

  async update(auth: AuthContext, id: string, input: UpdateCustomerDto): Promise<CustomerResponseDto> {
    const before = await this.getById(auth, id);

    // Cross-field rules run on the record as it will be after the change.
    const issues = customerRuleIssues({
      type: input.type ?? before.type,
      gstin: input.gstin === undefined ? before.gstin : input.gstin,
      stateCode: input.stateCode === undefined ? before.stateCode : input.stateCode,
    });
    if (issues.length) throw fieldErrors(issues);
    if (input.mobile && input.mobile !== before.mobile) await this.assertMobileFree(auth, input.mobile, id);

    const after = await this.customers.update(auth.businessId, id, input);
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
    const before = await this.getById(auth, id);
    await this.customers.softDelete(auth.businessId, id);
    await this.audit.record(auth, { action: "customer.delete", entity: "Customer", entityId: id, before });
  }

  private async assertMobileFree(auth: AuthContext, mobile: string, excludeId?: string) {
    const existing = await this.customers.findByMobile(auth.businessId, mobile, excludeId);
    if (existing) throw conflict(`${formatMobile(mobile)} already belongs to ${existing.name}`);
  }
}
