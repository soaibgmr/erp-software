import type { PosSettings, PrintSettings, SettingsGroup, TaxSettings } from "@automobile/shared";

export type { SettingsGroup };

export interface AllSettingsDto {
  tax: TaxSettings;
  print: PrintSettings;
  pos: PosSettings;
}

export interface StoredSetting {
  group: string;
  value: unknown;
}
