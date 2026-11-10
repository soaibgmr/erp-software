import { inject, injectable } from "inversify";
import {
  formatQty,
  ITEM_IMPORT_COLUMNS,
  itemImportRowSchema,
  milliToDecimal,
  toMilli,
  type ItemImportColumn,
  type ItemImportRow,
  type StockImportInput,
} from "@erp-software/shared";
import { TYPES } from "../../config/ioc.types";
import type { AuthContext } from "../../common/auth-context";
import { badRequest } from "../../common/http-error";
import type { IUnitOfWork } from "../../common/unit-of-work";
import type { IAuditService } from "../audit/interfaces/iaudit.service";
import type { IItemRepository } from "../items/interfaces/iitem.repository";
import type { IStockRepository } from "./interfaces/istock.repository";
import type { IStockImportService, IStockService } from "./interfaces/istock.service";
import type { ImportReport, ImportRowReport, StockMovement } from "./stock.types";

// "Sale Price", "sale_price" and "SALEPRICE" all match the salePrice column.
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const COLUMN_BY_NORM = new Map<string, ItemImportColumn>(ITEM_IMPORT_COLUMNS.map((c) => [norm(c), c]));
const ALIASES: Record<string, ItemImportColumn> = {
  partname: "name",
  itemname: "name",
  description: "name",
  partno: "oemPartNo",
  oem: "oemPartNo",
  oemno: "oemPartNo",
  hsn: "hsnCode",
  gst: "gstRate",
  gstpercent: "gstRate",
  price: "salePrice",
  sellingprice: "salePrice",
  cost: "purchasePrice",
  costprice: "purchasePrice",
  qty: "openingQty",
  quantity: "openingQty",
  stock: "openingQty",
  openingstock: "openingQty",
  minstock: "minLevel",
  bin: "binLocation",
  location: "binLocation",
};
const columnFor = (header: string) => COLUMN_BY_NORM.get(norm(header)) ?? ALIASES[norm(header)];

interface ParsedRow {
  report: ImportRowReport;
  data?: ItemImportRow;
  existingId?: string;
}

@injectable()
export class StockImportService implements IStockImportService {
  constructor(
    @inject(TYPES.UnitOfWork) private readonly uow: IUnitOfWork,
    @inject(TYPES.StockService) private readonly stock: IStockService,
    @inject(TYPES.StockRepository) private readonly stockRepo: IStockRepository,
    @inject(TYPES.ItemRepository) private readonly items: IItemRepository,
    @inject(TYPES.AuditService) private readonly audit: IAuditService,
  ) {}

  async run(auth: AuthContext, branchId: string, input: StockImportInput): Promise<ImportReport> {
    const headers = Object.keys(input.rows[0] ?? {});
    const unknownColumns = headers.filter((h) => !columnFor(h));
    const mapped = input.rows.map((raw) => {
      const out: Record<string, string> = {};
      for (const [h, v] of Object.entries(raw)) {
        const col = columnFor(h);
        if (col && !(col in out && out[col] !== "")) out[col] = v ?? "";
      }
      return out;
    });
    if (!mapped.some((r) => "sku" in r) || !mapped.some((r) => "name" in r) || !mapped.some((r) => "salePrice" in r)) {
      throw badRequest("The file needs at least the sku, name and salePrice columns");
    }

    // 1. Field validation, one report per row.
    const parsed: ParsedRow[] = mapped.map((r, i) => {
      const report: ImportRowReport = {
        row: i + 2,
        sku: (r.sku ?? "").trim().toUpperCase(),
        name: (r.name ?? "").trim(),
        action: "create",
        openingQty: null,
        errors: [],
        warnings: [],
      };
      const result = itemImportRowSchema.safeParse(r);
      if (!result.success) {
        report.errors = result.error.issues.map((iss) => `${String(iss.path[0] ?? "row")}: ${iss.message}`);
        return { report };
      }
      return { report, data: result.data };
    });

    // 2. Duplicates inside the file.
    const firstRowBySku = new Map<string, number>();
    const firstRowByBarcode = new Map<string, number>();
    for (const p of parsed) {
      if (!p.data) continue;
      const seen = firstRowBySku.get(p.data.sku);
      if (seen) p.report.errors.push(`sku: also on row ${seen}`);
      else firstRowBySku.set(p.data.sku, p.report.row);
      if (p.data.barcode) {
        const b = firstRowByBarcode.get(p.data.barcode);
        if (b) p.report.errors.push(`barcode: also on row ${b}`);
        else firstRowByBarcode.set(p.data.barcode, p.report.row);
      }
    }

    // 3. Against the database: existing SKUs, barcodes on other items, brands and categories to create.
    const valid = parsed.filter((p) => p.data && !p.report.errors.length);
    const existing = new Map(
      (await this.items.findBySkus(valid.map((p) => p.data!.sku))).map((i) => [i.sku.toUpperCase(), i]),
    );
    for (const p of valid) {
      const found = existing.get(p.data!.sku);
      if (found) {
        p.existingId = found.id;
        p.report.action = input.updateExisting ? "update" : "skip";
      }
    }
    const barcodeOwners = await this.items.findBarcodeOwners(
      valid.flatMap((p) => (p.data!.barcode ? [p.data!.barcode] : [])),
    );
    for (const owner of barcodeOwners) {
      const p = valid.find((v) => v.data!.barcode === owner.code);
      // Re-importing an item with its own barcode is fine.
      if (p && owner.itemId !== p.existingId) {
        p.report.errors.push(`barcode: ${owner.code} is already on ${owner.itemName}`);
      }
    }

    const brandNames = uniqueCi(valid.flatMap((p) => (p.data!.brand ? [p.data!.brand] : [])));
    const categoryNames = uniqueCi(valid.flatMap((p) => (p.data!.category ? [p.data!.category] : [])));
    const [brands, categories] = await Promise.all([
      brandNames.length ? this.stockRepo.findBrandsByNames(brandNames) : [],
      categoryNames.length ? this.stockRepo.findCategoriesByNames(categoryNames) : [],
    ]);
    const brandIds = new Map(brands.map((b) => [b.name.toLowerCase(), b.id]));
    const categoryIds = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
    const newBrands = brandNames.filter((n) => !brandIds.has(n.toLowerCase()));
    const newCategories = categoryNames.filter((n) => !categoryIds.has(n.toLowerCase()));

    // 4. Opening stock is posted once per item and branch: items with ledger history keep their stock.
    const history = await this.stockRepo.itemsWithHistory(
      branchId,
      valid.flatMap((p) => (p.existingId ? [p.existingId] : [])),
    );
    for (const p of valid) {
      if (p.report.errors.length || toMilli(p.data!.openingQty) <= 0) continue;
      if (p.existingId && history.has(p.existingId)) {
        p.report.warnings.push(
          `Opening qty ${formatQty(p.data!.openingQty)} ignored: this item already has stock history in the branch`,
        );
      } else {
        p.report.openingQty = milliToDecimal(toMilli(p.data!.openingQty));
      }
    }

    for (const p of parsed) if (p.report.errors.length) p.report.action = "error";
    const report: ImportReport = {
      committed: false,
      total: parsed.length,
      errorCount: count(parsed, "error"),
      createCount: count(parsed, "create"),
      updateCount: count(parsed, "update"),
      skipCount: count(parsed, "skip"),
      openingStockCount: parsed.filter((p) => p.report.openingQty).length,
      newBrands,
      newCategories,
      unknownColumns,
      rows: parsed.map((p) => p.report),
    };
    if (!input.commit) return report;
    if (report.errorCount)
      throw badRequest(
        `Fix the ${report.errorCount} row${report.errorCount === 1 ? "" : "s"} with errors, then import again`,
      );

    await this.uow.run(
      async (tx) => {
        for (const name of newBrands) brandIds.set(name.toLowerCase(), (await this.stockRepo.createBrand(tx, name)).id);
        for (const name of newCategories)
          categoryIds.set(name.toLowerCase(), (await this.stockRepo.createCategory(tx, name)).id);

        const movements: StockMovement[] = [];
        const settings: { itemId: string; minLevel: number; reorderQty: number; binLocation: string | null }[] = [];
        for (const p of parsed) {
          const d = p.data!;
          const master = {
            name: d.name,
            oemPartNo: d.oemPartNo ?? null,
            brandId: d.brand ? brandIds.get(d.brand.toLowerCase())! : null,
            categoryId: d.category ? categoryIds.get(d.category.toLowerCase())! : null,
            hsnCode: d.hsnCode ?? null,
            gstRate: d.gstRate,
            unit: d.unit,
            mrp: d.mrp,
            salePrice: d.salePrice,
            purchasePrice: d.purchasePrice,
            taxInclusive: d.taxInclusive,
          };
          let itemId = p.existingId;
          if (p.report.action === "create") {
            itemId = (
              await this.items.create(
                { ...master, sku: d.sku, barcodes: d.barcode ? [d.barcode] : [], createdById: auth.userId },
                tx,
              )
            ).id;
          } else if (p.report.action === "update") {
            await this.items.update(itemId!, master, tx);
          }
          if (p.report.openingQty) {
            movements.push({
              branchId,
              itemId: itemId!,
              type: "OPENING",
              quantity: Number(p.report.openingQty),
              unitCost: d.purchasePrice,
              refType: "StockImport",
              note: "Imported opening stock",
            });
          }
          if (p.report.action !== "skip" && (d.minLevel || d.reorderQty || d.binLocation)) {
            // Applied after posting, once the movements have created and locked the rows.
            settings.push({
              itemId: itemId!,
              minLevel: d.minLevel,
              reorderQty: d.reorderQty,
              binLocation: d.binLocation ?? null,
            });
          }
        }
        await this.stock.post(tx, auth, movements, { allowNegative: true });
        for (const s of settings) await this.stock.applySettings(tx, branchId, s.itemId, s);
        await this.audit.record(
          auth,
          {
            action: "stock.import",
            entity: "Item",
            branchId,
            after: {
              created: report.createCount,
              updated: report.updateCount,
              skipped: report.skipCount,
              openingStock: report.openingStockCount,
            },
          },
          tx,
        );
      },
      { timeoutMs: 120_000 },
    );
    return { ...report, committed: true };
  }
}

const count = (rows: ParsedRow[], action: ImportRowReport["action"]) =>
  rows.filter((p) => p.report.action === action).length;

function uniqueCi(names: string[]): string[] {
  const seen = new Map<string, string>();
  for (const n of names) if (!seen.has(n.toLowerCase())) seen.set(n.toLowerCase(), n);
  return [...seen.values()];
}
