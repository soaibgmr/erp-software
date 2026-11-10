import { inject, injectable } from "inversify";
import { Prisma, PrismaClient } from "@prisma/client";
import { TYPES } from "../../config/ioc.types";
import type { Paginated } from "../../common/pagination";
import type { ICustomerRepository } from "./interfaces/icustomer.repository";
import type { CreateCustomerData, CustomerResponseDto, ListCustomersQuery, UpdateCustomerDto } from "./customer.types";

const customerSelect = {
  id: true,
  type: true,
  name: true,
  mobile: true,
  alternatePhone: true,
  email: true,
  address: true,
  city: true,
  pincode: true,
  stateCode: true,
  gstin: true,
  creditLimit: true,
  creditDays: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomerSelect;

type CustomerRow = Prisma.CustomerGetPayload<{ select: typeof customerSelect }>;

const toDto = (row: CustomerRow): CustomerResponseDto => ({ ...row, creditLimit: row.creditLimit.toFixed(2) });

@injectable()
export class CustomerRepository implements ICustomerRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<CustomerResponseDto | null> {
    const row = await this.prisma.customer.findFirst({ where: { id, deletedAt: null }, select: customerSelect });
    return row && toDto(row);
  }

  async findByMobile(mobile: string, excludeId?: string): Promise<CustomerResponseDto | null> {
    const row = await this.prisma.customer.findFirst({
      where: { mobile, deletedAt: null, ...(excludeId && { id: { not: excludeId } }) },
      select: customerSelect,
    });
    return row && toDto(row);
  }

  async list({ page, limit, search, type, sort }: ListCustomersQuery): Promise<Paginated<CustomerResponseDto>> {
    const digits = search?.replace(/\D/g, "");
    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      type,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { gstin: { startsWith: search.toUpperCase() } },
          { city: { contains: search, mode: "insensitive" } },
          ...(digits && digits.length >= 3 ? [{ mobile: { contains: digits } }] : []),
        ],
      }),
    };
    const orderBy: Prisma.CustomerOrderByWithRelationInput = sort === "name" ? { name: "asc" } : { createdAt: "desc" };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({ where, select: customerSelect, orderBy, skip: (page - 1) * limit, take: limit }),
      this.prisma.customer.count({ where }),
    ]);
    return { data: rows.map(toDto), page, limit, total };
  }

  async create(data: CreateCustomerData): Promise<CustomerResponseDto> {
    return toDto(await this.prisma.customer.create({ data, select: customerSelect }));
  }

  async update(id: string, data: UpdateCustomerDto): Promise<CustomerResponseDto | null> {
    const { count } = await this.prisma.customer.updateMany({ where: { id, deletedAt: null }, data });
    if (count === 0) return null;
    return this.findById(id);
  }

  async softDelete(id: string): Promise<boolean> {
    const { count } = await this.prisma.customer.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return count > 0;
  }
}
