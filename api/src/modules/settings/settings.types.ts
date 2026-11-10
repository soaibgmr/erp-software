import type { PosSettings, PrintSettings, SettingsGroup, TaxSettings } from "@erp-software/shared";

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
