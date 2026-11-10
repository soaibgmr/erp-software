import { inject, injectable } from "inversify";
import { Prisma, PrismaClient } from "@prisma/client";
import type { HeldCartCreate } from "@erp-software/shared";
import { TYPES } from "../../config/ioc.types";
import type { Db } from "../../common/prisma-types";
import { loadUserNames } from "../../common/user-names";
import type { IHeldCartRepository } from "./interfaces/iheld-cart.repository";
import type { CreateHeldCartData, HeldCartDto } from "./pos.types";

type Row = Prisma.HeldCartGetPayload<object>;
type Payload = HeldCartCreate & { total?: string; customerName?: string | null };

@injectable()
export class HeldCartRepository implements IHeldCartRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  async list(branchId: string): Promise<HeldCartDto[]> {
    const rows = await this.prisma.heldCart.findMany({
      where: { branchId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return this.toDtos(rows);
  }

  async findById(id: string): Promise<HeldCartDto | null> {
    const row = await this.prisma.heldCart.findFirst({ where: { id, deletedAt: null } });
    return row ? (await this.toDtos([row]))[0]! : null;
  }

  async create(data: CreateHeldCartData): Promise<HeldCartDto> {
    const row = await this.prisma.heldCart.create({
      data: { ...data, payload: data.payload as Prisma.InputJsonValue },
    });
    return (await this.toDtos([row]))[0]!;
  }

  async softDelete(id: string, db: Db = this.prisma): Promise<boolean> {
    const { count } = await db.heldCart.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
    return count > 0;
  }

  private async toDtos(rows: Row[]): Promise<HeldCartDto[]> {
    const users = await loadUserNames(
      this.prisma,
      rows.map((r) => r.userId),
    );
    return rows.map((r) => {
      // `cart` is exactly what /pos/quote and the charge accept, so the POS can send it back as is.
      const { total, customerName, label: _label, ...cart } = r.payload as Payload;
      return {
        id: r.id,
        branchId: r.branchId,
        label: r.label,
        customerId: r.customerId,
        customerName: customerName ?? null,
        lineCount: cart.lines?.length ?? 0,
        total: total ?? "0.00",
        cart,
        createdAt: r.createdAt,
        createdBy: users.get(r.userId) ?? null,
      };
    });
  }
}
