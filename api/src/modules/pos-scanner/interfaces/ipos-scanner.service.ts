import type { AuthContext } from "../../../common/auth-context";
import type { ScanPollDto, ScanResultDto, ScanSessionCreatedDto, ScanSessionInfoDto } from "../pos-scanner.types";

export interface IPosScannerService {
  // Counter PC (logged in)
  create(auth: AuthContext, branchId: string): Promise<ScanSessionCreatedDto>;
  poll(auth: AuthContext, id: string, after: string | undefined): Promise<ScanPollDto>;
  end(auth: AuthContext, id: string): Promise<void>;

  // Phone (holds only the session token)
  ping(id: string, token: string | undefined): Promise<ScanSessionInfoDto>;
  scan(id: string, token: string | undefined, code: string): Promise<ScanResultDto>;
}
