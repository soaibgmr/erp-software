import { inject, injectable } from "inversify";
import { Prisma, PrismaClient } from "@prisma/client";
import { milliToDecimal, toMilli } from "@automobile/shared";
import { TYPES } from "../../config/ioc.types";
import type { Paginated } from "../../common/pagination";
import type { Db } from "../../common/prisma-types";
import { loadUserNames } from "../../common/user-names";
import type { IStockRepository } from "./interfaces/istock.repository";
import { toStockDto, type BranchStockRow } from "./stock.mapper";
import type {
  LedgerEntryDto,
  LedgerInsert,
  LineItem,
  LockedBalance,
  StockListFilter,
  StockRowDto,
  UpdateStockSettingsDto,
} from "./stock.types";

const stockSelect = {
  branchId: true,
  onHand: true,
  reserved: true,
  inTransit: true,
  minLevel: true,
  reorderQty: true,
  binLocation: true,
} satisfies Prisma.BranchStockSelect;

// Escape LIKE wildcards in user input.
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const AVAILABLE = Prisma.sql`(COALESCE(bs.on_hand, 0) - COALESCE(bs.reserved, 0))`;
const MIN_LEVEL = Prisma.sql`COALESCE(bs.min_level, 0)`;

interface StockListRaw {
  itemId: string;
  sku: string;
  name: string;
  oemPartNo: string | null;
  unit: StockRowDto["unit"];
  brandName: string | null;
  categoryName: string | null;
  salePrice: string;
  purchasePrice: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  onHand: string;
  reserved: string;
  inTransit: string;
  minLevel: string;
  reorderQty: string;
  binLocation: string | null;
  total: bigint;
}

@injectable()
export class StockRepository implements IStockRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  async lockBalances(db: Db, pairs: { branchId: string; itemId: string }[]): Promise<LockedBalance[]> {
    if (!pairs.length) return [];
    const sorted = [...pairs].sort((a, b) => a.branchId.localeCompare(b.branchId) || a.itemId.localeCompare(b.itemId));
    const branchIds = sorted.map((p) => p.branchId);
    const itemIds = sorted.map((p) => p.itemId);

    await db.$executeRaw`
      INSERT INTO branch_stock (branch_id, item_id, updated_at)
      SELECT t.b, t.i, now() FROM unnest(${branchIds}::uuid[], ${itemIds}::uuid[]) AS t(b, i)
      ON CONFLICT (branch_id, item_id) DO NOTHING`;

    // Stable lock order (branch, item) so two postings touching the same rows can't deadlock.
    const rows = await db.$queryRaw<
      { branchId: string; itemId: string; sku: string; name: string; onHand: string; reserved: string }[]
    >`
      SELECT bs.branch_id AS "branchId", bs.item_id AS "itemId", i.sku, i.name,
             bs.on_hand::text AS "onHand", bs.reserved::text AS "reserved"
        FROM branch_stock bs
        JOIN items i ON i.id = bs.item_id
       WHERE (bs.branch_id, bs.item_id) IN (SELECT * FROM unnest(${branchIds}::uuid[], ${itemIds}::uuid[]))
       ORDER BY bs.branch_id, bs.item_id
         FOR UPDATE OF bs`;
    return rows.map((r) => ({ ...r, onHand: toMilli(r.onHand), reserved: toMilli(r.reserved) }));
  }

  async insertLedger(db: Db, rows: LedgerInsert[]): Promise<void> {
    if (rows.length) await db.stockLedger.createMany({ data: rows });
  }

  async setOnHand(db: Db, branchId: string, itemId: string, onHandMilli: number): Promise<void> {
    await db.branchStock.update({
      where: { branchId_itemId: { branchId, itemId } },
      data: { onHand: milliToDecimal(onHandMilli) },
    });
  }

  async addInTransit(db: Db, branchId: string, itemId: string, deltaMilli: number): Promise<void> {
    const delta = milliToDecimal(deltaMilli);
    await db.$executeRaw`
      INSERT INTO branch_stock (branch_id, item_id, in_transit, updated_at)
      VALUES (${branchId}::uuid, ${itemId}::uuid, GREATEST(${delta}::numeric, 0), now())
      ON CONFLICT (branch_id, item_id)
      DO UPDATE SET in_transit = GREATEST(branch_stock.in_transit + ${delta}::numeric, 0), updated_at = now()`;
  }

  async list(f: StockListFilter): Promise<Paginated<StockRowDto>> {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`i.deleted_at IS NULL`,
      Prisma.sql`i.is_active`,
      Prisma.sql`b.id = ANY(${f.branchIds}::uuid[])`,
    ];
    if (!f.includeEmpty) conditions.push(Prisma.sql`bs.item_id IS NOT NULL`);
    if (f.categoryId) conditions.push(Prisma.sql`i.category_id = ${f.categoryId}::uuid`);
    if (f.brandId) conditions.push(Prisma.sql`i.brand_id = ${f.brandId}::uuid`);
    for (const word of f.search?.split(/\s+/).filter(Boolean).slice(0, 6) ?? []) {
      const like = `%${likeEscape(word)}%`;
      conditions.push(
        Prisma.sql`(i.name ILIKE ${like} OR i.sku ILIKE ${like} OR i.oem_part_no ILIKE ${like} OR br.name ILIKE ${like}
                    OR EXISTS (SELECT 1 FROM item_barcodes ib WHERE ib.item_id = i.id AND ib.code = ${word}))`,
      );
    }
    if (f.status === "OUT") conditions.push(Prisma.sql`${AVAILABLE} <= 0`);
    // Low = needs reordering: tracked (min level set) and at or below it, including out of stock.
    if (f.status === "LOW") conditions.push(Prisma.sql`${MIN_LEVEL} > 0 AND ${AVAILABLE} <= ${MIN_LEVEL}`);
    if (f.status === "IN_STOCK")
      conditions.push(Prisma.sql`${AVAILABLE} > 0 AND (${MIN_LEVEL} = 0 OR ${AVAILABLE} > ${MIN_LEVEL})`);

    const orderBy =
      f.sort === "sku"
        ? Prisma.sql`i.sku, b.code`
        : f.sort === "available"
          ? Prisma.sql`${AVAILABLE} - ${MIN_LEVEL}, i.name, b.code`
          : Prisma.sql`i.name, b.code`;

    const rows = await this.prisma.$queryRaw<StockListRaw[]>`
      SELECT i.id AS "itemId", i.sku, i.name, i.oem_part_no AS "oemPartNo", i.unit::text AS unit,
             br.name AS "brandName", c.name AS "categoryName",
             i.sale_price::text AS "salePrice", i.purchase_price::text AS "purchasePrice",
             b.id AS "branchId", b.code AS "branchCode", b.name AS "branchName",
             COALESCE(bs.on_hand, 0)::text AS "onHand", COALESCE(bs.reserved, 0)::text AS reserved,
             COALESCE(bs.in_transit, 0)::text AS "inTransit", ${MIN_LEVEL}::text AS "minLevel",
             COALESCE(bs.reorder_qty, 0)::text AS "reorderQty", bs.bin_location AS "binLocation",
             COUNT(*) OVER () AS total
        FROM items i
        JOIN branches b ON b.deleted_at IS NULL
        LEFT JOIN branch_stock bs ON bs.item_id = i.id AND bs.branch_id = b.id
        LEFT JOIN brands br ON br.id = i.brand_id
        LEFT JOIN item_categories c ON c.id = i.category_id
       WHERE ${Prisma.join(conditions, " AND ")}
       ORDER BY ${orderBy}
       LIMIT ${f.limit} OFFSET ${(f.page - 1) * f.limit}`;

    const data = rows.map(({ total: _total, ...r }): StockRowDto => ({
      ...toStockDto(r),
      itemId: r.itemId,
      sku: r.sku,
      name: r.name,
      oemPartNo: r.oemPartNo,
      unit: r.unit,
      brandName: r.brandName,
      categoryName: r.categoryName,
      salePrice: Number(r.salePrice).toFixed(2),
      purchasePrice: Number(r.purchasePrice).toFixed(2),
      branchCode: r.branchCode,
      branchName: r.branchName,
    }));
    return { data, page: f.page, limit: f.limit, total: Number(rows[0]?.total ?? 0) };
  }

  async ledger(branchId: string, itemId: string, page: number, limit: number): Promise<Paginated<LedgerEntryDto>> {
    const where = { branchId, itemId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stockLedger.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockLedger.count({ where }),
    ]);
    const users = await loadUserNames(
      this.prisma,
      rows.map((r) => r.createdById),
    );
    const data = rows.map((r) => ({
      id: r.id,
      type: r.type,
      quantity: r.quantity.toFixed(3),
      balanceAfter: r.balanceAfter.toFixed(3),
      unitCost: r.unitCost?.toFixed(2) ?? null,
      refType: r.refType,
      refId: r.refId,
      refNo: r.refNo,
      note: r.note,
      createdAt: r.createdAt,
      createdBy: (r.createdById && users.get(r.createdById)) || null,
    }));
    return { data, page, limit, total };
  }

  findStock(branchId: string, itemId: string): Promise<BranchStockRow | null> {
    return this.prisma.branchStock.findUnique({
      where: { branchId_itemId: { branchId, itemId } },
      select: stockSelect,
    });
  }

  upsertSettings(
    branchId: string,
    itemId: string,
    data: UpdateStockSettingsDto,
    db: Db = this.prisma,
  ): Promise<BranchStockRow> {
    return db.branchStock.upsert({
      where: { branchId_itemId: { branchId, itemId } },
      create: { branchId, itemId, ...data },
      update: data,
      select: stockSelect,
    });
  }

  async findLineItems(ids: string[]): Promise<LineItem[]> {
    if (!ids.length) return [];
    const rows = await this.prisma.item.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, sku: true, name: true, unit: true, purchasePrice: true },
    });
    return rows.map((r) => ({ ...r, purchasePrice: r.purchasePrice.toFixed(2) }));
  }

  async itemsWithHistory(branchId: string, itemIds: string[]): Promise<Set<string>> {
    if (!itemIds.length) return new Set();
    const rows = await this.prisma.stockLedger.findMany({
      where: { branchId, itemId: { in: itemIds } },
      select: { itemId: true },
      distinct: ["itemId"],
    });
    return new Set(rows.map((r) => r.itemId));
  }

  findBrandsByNames(names: string[]) {
    return this.prisma.brand.findMany({
      where: { deletedAt: null, OR: names.map((name) => ({ name: { equals: name, mode: "insensitive" as const } })) },
      select: { id: true, name: true },
    });
  }

  findCategoriesByNames(names: string[]) {
    return this.prisma.itemCategory.findMany({
      where: { deletedAt: null, OR: names.map((name) => ({ name: { equals: name, mode: "insensitive" as const } })) },
      select: { id: true, name: true },
    });
  }

  createBrand(db: Db, name: string) {
    return db.brand.create({ data: { name }, select: { id: true, name: true } });
  }

  createCategory(db: Db, name: string) {
    return db.itemCategory.create({ data: { name }, select: { id: true, name: true } });
  }
}
