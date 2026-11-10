import type { Paginated } from "../../../common/pagination";
import type { Db } from "../../../common/prisma-types";
import type { AuditLogResponseDto, CreateAuditLogData, ListAuditLogsQuery } from "../audit.types";

export interface IAuditRepository {
  create(data: CreateAuditLogData, db?: Db): Promise<void>;
  list(businessId: string, query: ListAuditLogsQuery): Promise<Paginated<AuditLogResponseDto>>;
}
