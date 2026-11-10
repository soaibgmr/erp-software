import type { SettingsValue } from "@erp-software/shared";
import type { AuthContext } from "../../../common/auth-context";
import type { AllSettingsDto, SettingsGroup } from "../settings.types";

export interface ISettingsService {
  getAll(businessId: string): Promise<AllSettingsDto>;
  get<G extends SettingsGroup>(businessId: string, group: G): Promise<SettingsValue<G>>;
  // Merges `input` into the stored value and validates the result.
  update<G extends SettingsGroup>(auth: AuthContext, group: G, input: unknown): Promise<SettingsValue<G>>;
}
