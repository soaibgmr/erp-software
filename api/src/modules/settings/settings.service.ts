import { inject, injectable } from "inversify";
import { z } from "zod";
import { defaultSettings, patchOf, SETTINGS_GROUPS, SETTINGS_SCHEMAS, type SettingsValue } from "@erp-software/shared";
import { TYPES } from "../../config/ioc.types";
import { logger } from "../../config/logger";
import type { AuthContext } from "../../common/auth-context";
import { badRequest } from "../../common/http-error";
import type { IAuditService } from "../audit/interfaces/iaudit.service";
import type { ISettingsRepository } from "./interfaces/isettings.repository";
import type { ISettingsService } from "./interfaces/isettings.service";
import type { AllSettingsDto, SettingsGroup } from "./settings.types";

@injectable()
export class SettingsService implements ISettingsService {
  constructor(
    @inject(TYPES.SettingsRepository) private readonly settings: ISettingsRepository,
    @inject(TYPES.AuditService) private readonly audit: IAuditService,
  ) {}

  async getAll(): Promise<AllSettingsDto> {
    const stored = await this.settings.findAll();
    const entries = SETTINGS_GROUPS.map((group) => [
      group,
      this.parse(group, stored.find((s) => s.group === group)?.value),
    ]);
    return Object.fromEntries(entries) as AllSettingsDto;
  }

  async get<G extends SettingsGroup>(group: G): Promise<SettingsValue<G>> {
    return this.parse(group, (await this.settings.find(group))?.value);
  }

  async update<G extends SettingsGroup>(auth: AuthContext, group: G, input: unknown): Promise<SettingsValue<G>> {
    // Widened so the union of group schemas doesn't defeat overload resolution.
    const schema: z.ZodObject = SETTINGS_SCHEMAS[group];
    const patch = patchOf(schema).safeParse(input ?? {});
    if (!patch.success) throw badRequest("Invalid request body", z.flattenError(patch.error));

    const before = await this.get(group);
    const after = schema.parse({ ...before, ...stripUndefined(patch.data) }) as SettingsValue<G>;

    await this.settings.upsert(group, after, auth.userId);
    await this.audit.record(auth, {
      action: `settings.${group}.update`,
      entity: "Setting",
      entityId: group,
      before,
      after,
    });
    return after;
  }

  // Stored values are re-validated on read; missing keys get their defaults, a corrupt row falls back to defaults.
  private parse<G extends SettingsGroup>(group: G, value: unknown): SettingsValue<G> {
    if (value === undefined) return defaultSettings(group);
    const result = SETTINGS_SCHEMAS[group].safeParse(value);
    if (result.success) return result.data as SettingsValue<G>;
    logger.warn({ group, issues: result.error.issues }, "Stored settings are invalid; using defaults");
    return defaultSettings(group);
  }
}

const stripUndefined = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
