import type { Db } from "../../../common/prisma-types";
import type { CreateHeldCartData, HeldCartDto } from "../pos.types";

export interface IHeldCartRepository {
  list(branchId: string): Promise<HeldCartDto[]>;
  findById(id: string): Promise<HeldCartDto | null>;
  create(data: CreateHeldCartData): Promise<HeldCartDto>;
  /** Only deletes the cart if it belongs to `branchId`. */
  softDelete(id: string, branchId: string, db?: Db): Promise<boolean>;
}
