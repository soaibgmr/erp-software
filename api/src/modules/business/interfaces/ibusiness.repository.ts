import type { BusinessResponseDto, UpdateBusinessDto } from "../business.types";

export interface IBusinessRepository {
  // The single business row, or null before the seed has run.
  get(): Promise<BusinessResponseDto | null>;
  update(id: string, data: UpdateBusinessDto): Promise<BusinessResponseDto>;
}
