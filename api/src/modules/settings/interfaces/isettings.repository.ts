import type { SettingsGroup, StoredSetting } from "../settings.types";

// Settings are per business; a missing row means "use the defaults".
export interface ISettingsRepository {
  findAll(businessId: string): Promise<StoredSetting[]>;
  find(businessId: string, group: SettingsGroup): Promise<StoredSetting | null>;
  upsert(businessId: string, group: SettingsGroup, value: object, updatedById: string): Promise<void>;
}
