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
  usage?: (p: PrismaClient, id: string) => Promise<number>;
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
    usage: (p, id) => p.item.count({ where: { categoryId: id, deletedAt: null } }),
  },
  brands: {
    delegate: (p) => p.brand as unknown as Delegate,
    select: { id: true, name: true, _count: { select: activeItems } },
    orderBy: { name: "asc" },
    toDto: (r) => ({ id: r.id, name: r.name as string, itemCount: (r._count as { items: number }).items }),
    searchWhere: (s) => ({ name: { contains: s, mode: "insensitive" } }),
    usage: (p, id) => p.item.count({ where: { brandId: id, deletedAt: null } }),
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
    usage: (p, id) => p.vehicleModel.count({ where: { makeId: id, deletedAt: null } }),
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

  async list(kind: CatalogKind, { search, makeId }: ListCatalogQuery): Promise<CatalogDto[]> {
    const c = CONFIG[kind];
    const rows = await c.delegate(this.prisma).findMany({
      where: {
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

  async findById(kind: CatalogKind, id: string): Promise<CatalogDto | null> {
    const c = CONFIG[kind];
    const row = await c.delegate(this.prisma).findFirst({ where: { id, deletedAt: null }, select: c.select });
    return row && c.toDto(row);
  }

  async findByKey(
    kind: CatalogKind,
    key: string,
    scope: { makeId?: string },
    excludeId?: string,
  ): Promise<{ id: string } | null> {
    const field = kind === "hsnSac" ? "code" : "name";
    return CONFIG[kind].delegate(this.prisma).findFirst({
      where: {
        deletedAt: null,
        [field]: { equals: key, mode: "insensitive" },
        ...(kind === "vehicleModels" && { makeId: scope.makeId }),
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { id: true },
    });
  }

  async create(kind: CatalogKind, data: CatalogInput): Promise<CatalogDto> {
    const c = CONFIG[kind];
    const row = await c.delegate(this.prisma).create({ data, select: c.select });
    return c.toDto(row);
  }

  async update(kind: CatalogKind, id: string, data: CatalogInput): Promise<CatalogDto | null> {
    const { count } = await CONFIG[kind].delegate(this.prisma).updateMany({ where: { id, deletedAt: null }, data });
    return count ? this.findById(kind, id) : null;
  }

  async softDelete(kind: CatalogKind, id: string): Promise<boolean> {
    const { count } = await CONFIG[kind].delegate(this.prisma).updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return count > 0;
  }

  usage(kind: CatalogKind, id: string): Promise<number> {
    return CONFIG[kind].usage?.(this.prisma, id) ?? Promise.resolve(0);
  }
}
