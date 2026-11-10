import { inject, injectable } from "inversify";
import { TYPES } from "../../config/ioc.types";
import type { AuthContext } from "../../common/auth-context";
import { fieldErrors, notFound } from "../../common/http-error";
import type { IAuditService } from "../audit/interfaces/iaudit.service";
import type { IBusinessRepository } from "./interfaces/ibusiness.repository";
import type { IBusinessService } from "./interfaces/ibusiness.service";
import type { BusinessResponseDto, UpdateBusinessDto } from "./business.types";

@injectable()
export class BusinessService implements IBusinessService {
  constructor(
    @inject(TYPES.BusinessRepository) private readonly business: IBusinessRepository,
    @inject(TYPES.AuditService) private readonly audit: IAuditService,
  ) {}

  async get(businessId: string): Promise<BusinessResponseDto> {
    const business = await this.business.get(businessId);
    if (!business) throw notFound("Business not found");
    return business;
  }

  async update(auth: AuthContext, input: UpdateBusinessDto): Promise<BusinessResponseDto> {
    const before = await this.get(auth.businessId);

    // The schema checks GSTIN vs state when both are sent; re-check against stored values for partial updates.
    const gstin = input.gstin === undefined ? before.gstin : input.gstin;
    const stateCode = input.stateCode ?? before.stateCode;
    if (gstin && gstin.slice(0, 2) !== stateCode) {
      throw fieldErrors([{ path: "stateCode", message: "State must match the GSTIN state code" }]);
    }

    const after = await this.business.update(before.id, input);
    await this.audit.record(auth, {
      action: "business.update",
      entity: "Business",
      entityId: before.id,
      before,
      after,
    });
    return after;
  }
}
