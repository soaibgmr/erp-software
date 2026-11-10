import type { BusinessResponseDto, BusinessSummary, UpdateBusinessDto } from "../business.types";

export interface IBusinessRepository {
  get(id: string): Promise<BusinessResponseDto | null>;
  // Display name (trade name, else legal name) and status.
  getSummary(id: string): Promise<BusinessSummary | null>;
  update(id: string, data: UpdateBusinessDto): Promise<BusinessResponseDto>;
}
