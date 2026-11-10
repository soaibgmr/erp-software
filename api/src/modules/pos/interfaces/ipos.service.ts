import type { AuthContext } from "../../../common/auth-context";
import type { QuoteDto, QuoteDtoInput } from "../../invoices/invoice.types";
import type { CreateHeldCartDto, HeldCartDto } from "../pos.types";

export interface IPosService {
  // Server-side totals for a cart, with the same engine the charge uses.
  quote(auth: AuthContext, branchId: string, input: QuoteDtoInput): Promise<QuoteDto>;
  listHeld(branchId: string): Promise<HeldCartDto[]>;
  getHeld(auth: AuthContext, id: string): Promise<HeldCartDto>;
  hold(auth: AuthContext, branchId: string, input: CreateHeldCartDto): Promise<HeldCartDto>;
  removeHeld(auth: AuthContext, id: string): Promise<void>;
}
