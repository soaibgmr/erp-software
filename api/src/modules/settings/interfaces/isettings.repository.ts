import type { SettingsGroup, StoredSetting } from "../settings.types";

export interface ISettingsRepository {
  findAll(): Promise<StoredSetting[]>;
  find(group: SettingsGroup): Promise<StoredSetting | null>;
  upsert(group: SettingsGroup, value: object, updatedById: string): Promise<void>;
}
