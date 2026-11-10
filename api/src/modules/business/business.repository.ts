import { inject, injectable } from "inversify";
import { Prisma, PrismaClient } from "@prisma/client";
import { TYPES } from "../../config/ioc.types";
import type { IBusinessRepository } from "./interfaces/ibusiness.repository";
import type { BusinessResponseDto, BusinessSummary, UpdateBusinessDto } from "./business.types";

const businessSelect = {
  id: true,
  legalName: true,
  tradeName: true,
  address: true,
  city: true,
  pincode: true,
  stateCode: true,
  gstin: true,
  phone: true,
  email: true,
  website: true,
  bankName: true,
  bankAccountNo: true,
  bankIfsc: true,
  upiId: true,
  updatedAt: true,
} satisfies Prisma.BusinessSelect;

@injectable()
export class BusinessRepository implements IBusinessRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  get(id: string): Promise<BusinessResponseDto | null> {
    return this.prisma.business.findUnique({ where: { id }, select: businessSelect });
  }

  async getSummary(id: string): Promise<BusinessSummary | null> {
    const row = await this.prisma.business.findUnique({
      where: { id },
      select: { id: true, legalName: true, tradeName: true, status: true },
    });
    return row && { id: row.id, name: row.tradeName ?? row.legalName, status: row.status };
  }

  update(id: string, data: UpdateBusinessDto): Promise<BusinessResponseDto> {
    return this.prisma.business.update({ where: { id }, data, select: businessSelect });
  }
}
