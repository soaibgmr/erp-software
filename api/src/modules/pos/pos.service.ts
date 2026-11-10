import { inject, injectable } from "inversify";
import { TYPES } from "../../config/ioc.types";
import { canAccessBranch, type AuthContext } from "../../common/auth-context";
import { notFound } from "../../common/http-error";
import type { ICartPricer } from "../invoices/interfaces/iinvoice.service";
import type { QuoteDto, QuoteDtoInput } from "../invoices/invoice.types";
import type { IHeldCartRepository } from "./interfaces/iheld-cart.repository";
import type { IPosService } from "./interfaces/ipos.service";
import type { CreateHeldCartDto, HeldCartDto } from "./pos.types";

@injectable()
export class PosService implements IPosService {
  constructor(
    @inject(TYPES.CartPricer) private readonly pricer: ICartPricer,
    @inject(TYPES.HeldCartRepository) private readonly heldCarts: IHeldCartRepository,
  ) {}

  async quote(auth: AuthContext, branchId: string, input: QuoteDtoInput): Promise<QuoteDto> {
    return (await this.pricer.price(auth, branchId, input)).quote;
  }

  listHeld(branchId: string): Promise<HeldCartDto[]> {
    return this.heldCarts.list(branchId);
  }

  async getHeld(auth: AuthContext, id: string): Promise<HeldCartDto> {
    const cart = await this.heldCarts.findById(id);
    if (!cart || !canAccessBranch(auth, cart.branchId)) throw notFound("Held cart not found");
    return cart;
  }

  async hold(auth: AuthContext, branchId: string, input: CreateHeldCartDto): Promise<HeldCartDto> {
    // Pricing validates the lines and gives the list a total to show.
    const { quote } = await this.pricer.price(auth, branchId, input);
    return this.heldCarts.create({
      branchId,
      userId: auth.userId,
      label: input.label ?? null,
      customerId: input.customerId ?? null,
      payload: { ...input, total: quote.total, customerName: quote.customer?.name ?? null },
    });
  }

  async removeHeld(auth: AuthContext, id: string): Promise<void> {
    const cart = await this.getHeld(auth, id);
    await this.heldCarts.softDelete(id, cart.branchId);
  }
}
