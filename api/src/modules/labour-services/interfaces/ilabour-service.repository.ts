import type { Paginated } from "../../../common/pagination";
import type {
  CreateLabourServiceDto,
  LabourServiceResponseDto,
  ListLabourServicesQuery,
  UpdateLabourServiceDto,
} from "../labour-service.types";

// Labour services belong to one business; every method is limited to it.
export interface ILabourServiceRepository {
  findById(businessId: string, id: string): Promise<LabourServiceResponseDto | null>;
  // Active service with this name (case-insensitive).
  findByName(businessId: string, name: string, excludeId?: string): Promise<{ id: string } | null>;
  list(businessId: string, query: ListLabourServicesQuery): Promise<Paginated<LabourServiceResponseDto>>;
  create(businessId: string, data: CreateLabourServiceDto): Promise<LabourServiceResponseDto>;
  update(businessId: string, id: string, data: UpdateLabourServiceDto): Promise<LabourServiceResponseDto | null>;
  softDelete(businessId: string, id: string): Promise<boolean>;
}
