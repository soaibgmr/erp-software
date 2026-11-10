import { inject, injectable } from "inversify";
import type { Prisma } from "@prisma/client";
import { TYPES } from "../../config/ioc.types";
import type { Paginated } from "../../common/pagination";
import type { Db } from "../../common/prisma-types";
import type { IAuditRepository } from "./interfaces/iaudit.repository";
import type { IAuditService } from "./interfaces/iaudit.service";
import type { AuditActor, AuditEntry, AuditLogResponseDto, ListAuditLogsQuery } from "./audit.types";

// Dates, Decimals etc. become plain JSON; secrets are dropped before they reach the log.
const SECRET_KEYS = new Set(["password", "passwordHash", "token", "refreshToken"]);
function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value, (key, v) => (SECRET_KEYS.has(key) ? undefined : v)));
}

@injectable()
export class AuditService implements IAuditService {
  constructor(@inject(TYPES.AuditRepository) private readonly audit: IAuditRepository) {}

  record(actor: AuditActor, entry: AuditEntry, db?: Db): Promise<void> {
    return this.audit.create(
      {
        businessId: actor?.businessId ?? null,
        actorId: actor?.userId ?? null,
        branchId: entry.branchId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        before: toJson(entry.before),
        after: toJson(entry.after),
        ip: actor?.ip ?? null,
      },
      db,
    );
  }

  list(businessId: string, query: ListAuditLogsQuery): Promise<Paginated<AuditLogResponseDto>> {
    return this.audit.list(businessId, query);
  }
}
