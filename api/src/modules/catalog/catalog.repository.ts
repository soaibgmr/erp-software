import { inject, injectable } from "inversify";
import { Prisma, PrismaClient } from "@prisma/client";
import { TYPES } from "../../config/ioc.types";
import type { ICatalogRepository } from "./interfaces/icatalog.repository";
import type { CatalogDto, CatalogInput, CatalogKind, ListCatalogQuery } from "./catalog.types";

// The five catalog delegates share these method shapes; typing them loosely keeps one implementation.
interface Delegate {
  findMany(args: object): Promise<Row[]>;
  findFirst(args: object): Promise<Row | null>;
  create(args: object): Promise<Row>;
  updateMany(args: object): Promise<{ count: number }>;
}
type Row = Record<string, unknown> & { id: string };

const activeItems = { items: { where: { deletedAt: null } } };

interface KindConfig {
  delegate: (p: PrismaClient) => Delegate;
  select: object;
  orderBy: object;
  toDto: (row: Row) => CatalogDto;
  searchWhere: (search: string) => object;
  // Rows that still point at this record and block deleting it.
  usage?: (p: PrismaClient, businessId: string, id: string) => Promise<number>;
}

const CONFIG: Record<CatalogKind, KindConfig> = {
  categories: {
    delegate: (p) => p.itemCategory as unknown as Delegate,
    select: { id: true, name: true, description: true, _count: { select: activeItems } },
    orderBy: { name: "asc" },
    toDto: (r) => ({
      id: r.id,
      name: r.name as string,
      description: (r.description as string | null) ?? null,
      itemCount: (r._count as { items: number }).items,
    }),
    searchWhere: (s) => ({ name: { contains: s, mode: "insensitive" } }),
    usage: (p, businessId, id) => p.item.count({ where: { businessId, categoryId: id, deletedAt: null } }),
  },
  brands: {
    delegate: (p) => p.brand as unknown as Delegate,
    select: { id: true, name: true, _count: { select: activeItems } },
    orderBy: { name: "asc" },
    toDto: (r) => ({ id: r.id, name: r.name as string, itemCount: (r._count as { items: number }).items }),
    searchWhere: (s) => ({ name: { contains: s, mode: "insensitive" } }),
    usage: (p, businessId, id) => p.item.count({ where: { businessId, brandId: id, deletedAt: null } }),
  },
  hsnSac: {
    delegate: (p) => p.hsnSac as unknown as Delegate,
    select: { id: true, code: true, kind: true, description: true, gstRate: true },
    orderBy: [{ kind: "asc" }, { code: "asc" }],
    toDto: (r) => ({
      id: r.id,
      code: r.code as string,
      kind: r.kind as "HSN" | "SAC",
      description: r.description as string,
      gstRate: Number(r.gstRate as Prisma.Decimal),
    }),
    searchWhere: (s) => ({ OR: [{ code: { startsWith: s } }, { description: { contains: s, mode: "insensitive" } }] }),
  },
  vehicleMakes: {
    delegate: (p) => p.vehicleMake as unknown as Delegate,
    select: { id: true, name: true, _count: { select: { models: { where: { deletedAt: null } } } } },
    orderBy: { name: "asc" },
    toDto: (r) => ({ id: r.id, name: r.name as string, modelCount: (r._count as { models: number }).models }),
    searchWhere: (s) => ({ name: { contains: s, mode: "insensitive" } }),
    usage: (p, businessId, id) => p.vehicleModel.count({ where: { businessId, makeId: id, deletedAt: null } }),
  },
  vehicleModels: {
    delegate: (p) => p.vehicleModel as unknown as Delegate,
    select: { id: true, makeId: true, name: true, make: { select: { name: true } } },
    orderBy: [{ make: { name: "asc" } }, { name: "asc" }],
    toDto: (r) => ({
      id: r.id,
      makeId: r.makeId as string,
      makeName: (r.make as { name: string }).name,
      name: r.name as string,
    }),
    searchWhere: (s) => ({
      OR: [{ name: { contains: s, mode: "insensitive" } }, { make: { name: { contains: s, mode: "insensitive" } } }],
    }),
  },
};

@injectable()
export class CatalogRepository implements ICatalogRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  async list(businessId: string, kind: CatalogKind, { search, makeId }: ListCatalogQuery): Promise<CatalogDto[]> {
    const c = CONFIG[kind];
    const rows = await c.delegate(this.prisma).findMany({
      where: {
        businessId,
        deletedAt: null,
        ...(search && c.searchWhere(search)),
        ...(kind === "vehicleModels" && makeId && { makeId }),
      },
      select: c.select,
      orderBy: c.orderBy,
      take: 1000,
    });
    return rows.map(c.toDto);
  }

  async findById(businessId: string, kind: CatalogKind, id: string): Promise<CatalogDto | null> {
    const c = CONFIG[kind];
    const row = await c.delegate(this.prisma).findFirst({
      where: { id, businessId, deletedAt: null },
      select: c.select,
    });
    return row && c.toDto(row);
  }

  async findByKey(
    businessId: string,
    kind: CatalogKind,
    key: string,
    scope: { makeId?: string },
    excludeId?: string,
  ): Promise<{ id: string } | null> {
    const field = kind === "hsnSac" ? "code" : "name";
    return CONFIG[kind].delegate(this.prisma).findFirst({
      where: {
        businessId,
        deletedAt: null,
        [field]: { equals: key, mode: "insensitive" },
        ...(kind === "vehicleModels" && { makeId: scope.makeId }),
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { id: true },
    });
  }

  async create(businessId: string, kind: CatalogKind, data: CatalogInput): Promise<CatalogDto> {
    const c = CONFIG[kind];
    const row = await c.delegate(this.prisma).create({ data: { ...data, businessId }, select: c.select });
    return c.toDto(row);
  }

  async update(businessId: string, kind: CatalogKind, id: string, data: CatalogInput): Promise<CatalogDto | null> {
    const { count } = await CONFIG[kind]
      .delegate(this.prisma)
      .updateMany({ where: { id, businessId, deletedAt: null }, data });
    return count ? this.findById(businessId, kind, id) : null;
  }

  async softDelete(businessId: string, kind: CatalogKind, id: string): Promise<boolean> {
    const { count } = await CONFIG[kind].delegate(this.prisma).updateMany({
      where: { id, businessId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return count > 0;
  }

  usage(businessId: string, kind: CatalogKind, id: string): Promise<number> {
    return CONFIG[kind].usage?.(this.prisma, businessId, id) ?? Promise.resolve(0);
  }
}
