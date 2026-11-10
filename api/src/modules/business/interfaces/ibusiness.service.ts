import type { AuthContext } from "../../../common/auth-context";
import type { BusinessResponseDto, UpdateBusinessDto } from "../business.types";

export interface IBusinessService {
  get(businessId: string): Promise<BusinessResponseDto>;
  update(auth: AuthContext, input: UpdateBusinessDto): Promise<BusinessResponseDto>;
}
