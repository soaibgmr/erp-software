import type { Paginated } from "../../../common/pagination";
import type {
  CreateLabourServiceDto,
  LabourServiceResponseDto,
  ListLabourServicesQuery,
  UpdateLabourServiceDto,
} from "../labour-service.types";

export interface ILabourServiceRepository {
  findById(id: string): Promise<LabourServiceResponseDto | null>;
  // Active service with this name (case-insensitive).
  findByName(name: string, excludeId?: string): Promise<{ id: string } | null>;
  list(query: ListLabourServicesQuery): Promise<Paginated<LabourServiceResponseDto>>;
  create(data: CreateLabourServiceDto): Promise<LabourServiceResponseDto>;
  update(id: string, data: UpdateLabourServiceDto): Promise<LabourServiceResponseDto | null>;
  softDelete(id: string): Promise<boolean>;
}
