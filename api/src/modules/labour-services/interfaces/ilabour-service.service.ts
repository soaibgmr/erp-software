import type { AuthContext } from "../../../common/auth-context";
import type { Paginated } from "../../../common/pagination";
import type {
  CreateLabourServiceDto,
  LabourServiceResponseDto,
  ListLabourServicesQuery,
  UpdateLabourServiceDto,
} from "../labour-service.types";

export interface ILabourServiceService {
  list(auth: AuthContext, query: ListLabourServicesQuery): Promise<Paginated<LabourServiceResponseDto>>;
  getById(auth: AuthContext, id: string): Promise<LabourServiceResponseDto>;
  create(auth: AuthContext, input: CreateLabourServiceDto): Promise<LabourServiceResponseDto>;
  update(auth: AuthContext, id: string, input: UpdateLabourServiceDto): Promise<LabourServiceResponseDto>;
  remove(auth: AuthContext, id: string): Promise<void>;
}
