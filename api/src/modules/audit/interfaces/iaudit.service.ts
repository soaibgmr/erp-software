import type { Paginated } from "../../../common/pagination";
import type { Db } from "../../../common/prisma-types";
import type { AuditActor, AuditEntry, AuditLogResponseDto, ListAuditLogsQuery } from "../audit.types";

export interface IAuditService {
  // Pass `db` to write inside the caller's transaction.
  record(actor: AuditActor, entry: AuditEntry, db?: Db): Promise<void>;
  list(query: ListAuditLogsQuery): Promise<Paginated<AuditLogResponseDto>>;
}
