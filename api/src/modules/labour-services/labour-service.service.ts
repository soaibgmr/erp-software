import { inject, injectable } from "inversify";
import { TYPES } from "../../config/ioc.types";
import type { AuthContext } from "../../common/auth-context";
import { fieldErrors, notFound } from "../../common/http-error";
import type { Paginated } from "../../common/pagination";
import type { IAuditService } from "../audit/interfaces/iaudit.service";
import type { ILabourServiceRepository } from "./interfaces/ilabour-service.repository";
import type { ILabourServiceService } from "./interfaces/ilabour-service.service";
import type {
  CreateLabourServiceDto,
  LabourServiceResponseDto,
  ListLabourServicesQuery,
  UpdateLabourServiceDto,
} from "./labour-service.types";

@injectable()
export class LabourServiceService implements ILabourServiceService {
  constructor(
    @inject(TYPES.LabourServiceRepository) private readonly services: ILabourServiceRepository,
    @inject(TYPES.AuditService) private readonly audit: IAuditService,
  ) {}

  list(auth: AuthContext, query: ListLabourServicesQuery): Promise<Paginated<LabourServiceResponseDto>> {
    return this.services.list(auth.businessId, query);
  }

  async getById(auth: AuthContext, id: string): Promise<LabourServiceResponseDto> {
    const row = await this.services.findById(auth.businessId, id);
    if (!row) throw notFound("Labour service not found");
    return row;
  }

  async create(auth: AuthContext, input: CreateLabourServiceDto): Promise<LabourServiceResponseDto> {
    await this.assertNameFree(auth, input.name);
    return this.services.create(auth.businessId, input);
  }

  async update(auth: AuthContext, id: string, input: UpdateLabourServiceDto): Promise<LabourServiceResponseDto> {
    const before = await this.getById(auth, id);
    if (input.name && input.name.toLowerCase() !== before.name.toLowerCase())
      await this.assertNameFree(auth, input.name, id);

    const after = await this.services.update(auth.businessId, id, input);
    if (!after) throw notFound("Labour service not found");

    // Price changes are audited (PRD M12.1).
    if (after.rate !== before.rate || after.gstRate !== before.gstRate) {
      await this.audit.record(auth, {
        action: "labourService.price.update",
        entity: "LabourService",
        entityId: id,
        before: { rate: before.rate, gstRate: before.gstRate },
        after: { rate: after.rate, gstRate: after.gstRate },
      });
    }
    return after;
  }

  async remove(auth: AuthContext, id: string): Promise<void> {
    const before = await this.getById(auth, id);
    await this.services.softDelete(auth.businessId, id);
    await this.audit.record(auth, { action: "labourService.delete", entity: "LabourService", entityId: id, before });
  }

  private async assertNameFree(auth: AuthContext, name: string, excludeId?: string) {
    if (await this.services.findByName(auth.businessId, name, excludeId)) {
      throw fieldErrors([{ path: "name", message: `${name} already exists` }]);
    }
  }
}
