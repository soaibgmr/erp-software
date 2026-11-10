import { inject, injectable } from "inversify";
import { Prisma, PrismaClient } from "@prisma/client";
import { TYPES } from "../../config/ioc.types";
import type { Paginated } from "../../common/pagination";
import type { Db } from "../../common/prisma-types";
import { toStockDto } from "../stock/stock.mapper";
import type { IItemRepository } from "./interfaces/iitem.repository";
import type { ItemResponseDto, ItemSearchResultDto, ItemWriteData, ListItemsQuery } from "./item.types";

// Prisma needs a concrete uuid in the stock filter; this one never matches a branch.
const NO_BRANCH = "00000000-0000-0000-0000-000000000000";

const stockSelect = {
  branchId: true,
  onHand: true,
  reserved: true,
  inTransit: true,
  minLevel: true,
  reorderQty: true,
  binLocation: true,
} satisfies Prisma.BranchStockSelect;

const itemSelect = (branchId: string | undefined) =>
  ({
    id: true,
    sku: true,
    name: true,
    oemPartNo: true,
    description: true,
    hsnCode: true,
    gstRate: true,
    unit: true,
    mrp: true,
    salePrice: true,
    purchasePrice: true,
    taxInclusive: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    category: { select: { id: true, name: true } },
    brand: { select: { id: true, name: true } },
    barcodes: { select: { code: true }, orderBy: { createdAt: "asc" } },
    compatibility: {
      where: { vehicleModel: { deletedAt: null } },
      select: { vehicleModel: { select: { id: true, name: true, make: { select: { name: true } } } } },
    },
    stock: { where: { branchId: branchId ?? NO_BRANCH }, select: stockSelect },
  }) satisfies Prisma.ItemSelect;

type ItemRow = Prisma.ItemGetPayload<{ select: ReturnType<typeof itemSelect> }>;

const toDto = (r: ItemRow, branchId: string | undefined): ItemResponseDto => ({
  id: r.id,
  sku: r.sku,
  name: r.name,
  oemPartNo: r.oemPartNo,
  description: r.description,
  category: r.category,
  brand: r.brand,
  hsnCode: r.hsnCode,
  gstRate: Number(r.gstRate),
  unit: r.unit,
  mrp: r.mrp?.toFixed(2) ?? null,
  salePrice: r.salePrice.toFixed(2),
  purchasePrice: r.purchasePrice.toFixed(2),
  taxInclusive: r.taxInclusive,
  isActive: r.isActive,
  barcodes: r.barcodes.map((b) => b.code),
  compatibleModels: r.compatibility
    .map((c) => ({ id: c.vehicleModel.id, name: c.vehicleModel.name, makeName: c.vehicleModel.make.name }))
    .sort((a, b) => `${a.makeName} ${a.name}`.localeCompare(`${b.makeName} ${b.name}`)),
  stock: branchId ? toStockDto(r.stock[0] ?? { ...emptyRow, branchId }) : null,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

const emptyRow = { onHand: 0, reserved: 0, inTransit: 0, minLevel: 0, reorderQty: 0, binLocation: null };

const searchSelect = (branchId: string | undefined) =>
  ({
    id: true,
    sku: true,
    name: true,
    oemPartNo: true,
    hsnCode: true,
    gstRate: true,
    unit: true,
    mrp: true,
    salePrice: true,
    taxInclusive: true,
    brand: { select: { name: true } },
    barcodes: { select: { code: true } },
    stock: { where: { branchId: branchId ?? NO_BRANCH }, select: stockSelect },
  }) satisfies Prisma.ItemSelect;

type SearchRow = Prisma.ItemGetPayload<{ select: ReturnType<typeof searchSelect> }>;

function toSearchDto(r: SearchRow, branchId: string | undefined, term: string): ItemSearchResultDto {
  const upper = term.toUpperCase();
  const stock = branchId ? toStockDto(r.stock[0] ?? { ...emptyRow, branchId }) : null;
  return {
    id: r.id,
    sku: r.sku,
    name: r.name,
    oemPartNo: r.oemPartNo,
    brandName: r.brand?.name ?? null,
    hsnCode: r.hsnCode,
    gstRate: Number(r.gstRate),
    unit: r.unit,
    mrp: r.mrp?.toFixed(2) ?? null,
    salePrice: r.salePrice.toFixed(2),
    taxInclusive: r.taxInclusive,
    exact: r.sku === upper || r.oemPartNo?.toUpperCase() === upper || r.barcodes.some((b) => b.code === term),
    stock: stock && {
      onHand: stock.onHand,
      reserved: stock.reserved,
      available: stock.available,
      status: stock.status,
    },
  };
}

// Each word must match name, SKU, OEM number or brand: "oil filter swift" finds "Oil filter - Swift VXi".
function wordsWhere(search: string): Prisma.ItemWhereInput[] {
  return search
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((w) => ({
      OR: [
        { name: { contains: w, mode: "insensitive" } },
        { sku: { contains: w, mode: "insensitive" } },
        { oemPartNo: { contains: w, mode: "insensitive" } },
        { brand: { name: { contains: w, mode: "insensitive" } } },
      ],
    }));
}

const exactWhere = (term: string): Prisma.ItemWhereInput => ({
  OR: [
    { sku: { equals: term, mode: "insensitive" } },
    { oemPartNo: { equals: term, mode: "insensitive" } },
    { barcodes: { some: { code: term } } },
  ],
});

@injectable()
export class ItemRepository implements IItemRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  async findById(businessId: string, id: string, branchId?: string): Promise<ItemResponseDto | null> {
    const row = await this.prisma.item.findFirst({
      where: { id, businessId, deletedAt: null },
      select: itemSelect(branchId),
    });
    return row && toDto(row, branchId);
  }

  async list(businessId: string, q: ListItemsQuery, branchId?: string): Promise<Paginated<ItemResponseDto>> {
    const where: Prisma.ItemWhereInput = {
      businessId,
      deletedAt: null,
      categoryId: q.categoryId,
      brandId: q.brandId,
      isActive: q.isActive,
      ...(q.search && { OR: [exactWhere(q.search), { AND: wordsWhere(q.search) }] }),
    };
    const orderBy: Prisma.ItemOrderByWithRelationInput =
      q.sort === "sku" ? { sku: "asc" } : q.sort === "recent" ? { createdAt: "desc" } : { name: "asc" };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.item.findMany({
        where,
        select: itemSelect(branchId),
        orderBy,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.item.count({ where }),
    ]);
    return { data: rows.map((r) => toDto(r, branchId)), page: q.page, limit: q.limit, total };
  }

  async search(businessId: string, term: string, limit: number, branchId?: string): Promise<ItemSearchResultDto[]> {
    const base: Prisma.ItemWhereInput = { businessId, deletedAt: null, isActive: true };
    const select = searchSelect(branchId);
    // Exact SKU / OEM / barcode hits first, so a scanned or typed code is always on top.
    const [exact, fuzzy] = await Promise.all([
      this.prisma.item.findMany({ where: { ...base, ...exactWhere(term) }, select, take: 5 }),
      this.prisma.item.findMany({
        where: { ...base, AND: wordsWhere(term) },
        select,
        orderBy: { name: "asc" },
        take: limit,
      }),
    ]);
    const seen = new Set<string>();
    return [...exact, ...fuzzy]
      .filter((r) => !seen.has(r.id) && seen.add(r.id))
      .slice(0, limit)
      .map((r) => toSearchDto(r, branchId, term));
  }

  async findByCode(businessId: string, code: string, branchId?: string): Promise<ItemSearchResultDto | null> {
    const row = await this.prisma.item.findFirst({
      where: {
        businessId,
        deletedAt: null,
        OR: [{ barcodes: { some: { code } } }, { sku: { equals: code, mode: "insensitive" } }],
      },
      select: searchSelect(branchId),
    });
    return row && toSearchDto(row, branchId, code);
  }

  findSkuOwner(businessId: string, sku: string, excludeId?: string) {
    return this.prisma.item.findFirst({
      where: {
        businessId,
        deletedAt: null,
        sku: { equals: sku, mode: "insensitive" },
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { id: true, name: true },
    });
  }

  async findBarcodeOwners(businessId: string, codes: string[], excludeId?: string) {
    if (!codes.length) return [];
    const rows = await this.prisma.itemBarcode.findMany({
      where: {
        businessId,
        code: { in: codes },
        item: { deletedAt: null, ...(excludeId && { id: { not: excludeId } }) },
      },
      select: { code: true, itemId: true, item: { select: { name: true } } },
    });
    return rows.map((r) => ({ code: r.code, itemId: r.itemId, itemName: r.item.name }));
  }

  async countActiveModels(businessId: string, ids: string[]): Promise<number> {
    if (!ids.length) return 0;
    return this.prisma.vehicleModel.count({ where: { businessId, id: { in: ids }, deletedAt: null } });
  }

  async create(businessId: string, data: ItemWriteData, db: Db = this.prisma): Promise<{ id: string }> {
    const { barcodes = [], compatibleModelIds = [], ...scalars } = data;
    return db.item.create({
      data: {
        ...(scalars as Prisma.ItemUncheckedCreateInput),
        businessId,
        barcodes: { create: barcodes.map((code) => ({ code, businessId })) },
        compatibility: { create: compatibleModelIds.map((vehicleModelId) => ({ vehicleModelId })) },
      },
      select: { id: true },
    });
  }

  async update(businessId: string, id: string, data: ItemWriteData, db?: Db): Promise<boolean> {
    const { barcodes, compatibleModelIds, ...scalars } = data;
    const work = async (tx: Db) => {
      const { count } = await tx.item.updateMany({ where: { id, businessId, deletedAt: null }, data: scalars });
      if (!count) return false;
      if (barcodes) {
        await tx.itemBarcode.deleteMany({ where: { itemId: id } });
        await tx.itemBarcode.createMany({ data: barcodes.map((code) => ({ itemId: id, code, businessId })) });
      }
      if (compatibleModelIds) {
        await tx.itemCompatibility.deleteMany({ where: { itemId: id } });
        await tx.itemCompatibility.createMany({
          data: compatibleModelIds.map((vehicleModelId) => ({ itemId: id, vehicleModelId })),
        });
      }
      return true;
    };
    return db ? work(db) : this.prisma.$transaction((tx) => work(tx));
  }

  async softDelete(businessId: string, id: string): Promise<boolean> {
    const { count } = await this.prisma.item.updateMany({
      where: { id, businessId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return count > 0;
  }

  async hasStock(id: string): Promise<boolean> {
    const n = await this.prisma.branchStock.count({
      where: { itemId: id, OR: [{ onHand: { not: 0 } }, { reserved: { not: 0 } }, { inTransit: { not: 0 } }] },
    });
    return n > 0;
  }

  async stockRows(itemId: string) {
    return this.prisma.branchStock.findMany({ where: { itemId }, select: stockSelect });
  }

  async findBySkus(businessId: string, skus: string[]) {
    if (!skus.length) return [];
    return this.prisma.item.findMany({
      where: { businessId, deletedAt: null, sku: { in: skus } },
      select: { id: true, sku: true, name: true, purchasePrice: true },
    });
  }
}
