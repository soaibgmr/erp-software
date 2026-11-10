import { inject, injectable } from "inversify";
import { itemRuleIssues } from "@automobile/shared";
import { TYPES } from "../../config/ioc.types";
import type { AuthContext } from "../../common/auth-context";
import { conflict, fieldErrors, notFound } from "../../common/http-error";
import type { Paginated } from "../../common/pagination";
import type { IAuditService } from "../audit/interfaces/iaudit.service";
import type { IBranchRepository } from "../branches/interfaces/ibranch.repository";
import type { ICatalogRepository } from "../catalog/interfaces/icatalog.repository";
import { emptyStock, toStockDto } from "../stock/stock.mapper";
import type { IItemRepository } from "./interfaces/iitem.repository";
import type { IItemService } from "./interfaces/iitem.service";
import type {
  CreateItemDto,
  ItemDetailDto,
  ItemResponseDto,
  ItemSearchResultDto,
  ItemWriteData,
  ListItemsQuery,
  UpdateItemDto,
} from "./item.types";

type Issue = { path: string; message: string };

@injectable()
export class ItemService implements IItemService {
  constructor(
    @inject(TYPES.ItemRepository) private readonly items: IItemRepository,
    @inject(TYPES.CatalogRepository) private readonly catalog: ICatalogRepository,
    @inject(TYPES.BranchRepository) private readonly branches: IBranchRepository,
    @inject(TYPES.AuditService) private readonly audit: IAuditService,
  ) {}

  list(query: ListItemsQuery, branchId?: string): Promise<Paginated<ItemResponseDto>> {
    return this.items.list(query, branchId);
  }

  search(term: string, limit: number, branchId?: string): Promise<ItemSearchResultDto[]> {
    return this.items.search(term, limit, branchId);
  }

  async getByCode(code: string, branchId?: string): Promise<ItemSearchResultDto> {
    const item = await this.items.findByCode(code, branchId);
    if (!item) throw notFound(`No item has barcode or SKU ${code}`);
    return item;
  }

  async getById(auth: AuthContext, id: string, branchId?: string): Promise<ItemDetailDto> {
    const item = await this.items.findById(id, branchId);
    if (!item) throw notFound("Item not found");

    // One row per branch the user can see, zero-filled where the item was never stocked.
    const [rows, branches] = await Promise.all([
      this.items.stockRows(id),
      this.branches.list({ includeInactive: false, ids: auth.isOwner ? undefined : auth.branchIds }),
    ]);
    const stockByBranch = branches.map((b) => {
      const row = rows.find((r) => r.branchId === b.id);
      return { ...(row ? toStockDto(row) : emptyStock(b.id)), branchCode: b.code, branchName: b.name };
    });
    return { ...item, stockByBranch };
  }

  async create(auth: AuthContext, input: CreateItemDto, branchId?: string): Promise<ItemDetailDto> {
    await this.assertReferences(input);
    const { id } = await this.items.create({ ...input, createdById: auth.userId });
    return this.getById(auth, id, branchId);
  }

  async update(auth: AuthContext, id: string, input: UpdateItemDto, branchId?: string): Promise<ItemDetailDto> {
    const before = await this.items.findById(id);
    if (!before) throw notFound("Item not found");

    const merged = {
      salePrice: input.salePrice ?? Number(before.salePrice),
      mrp: input.mrp === undefined ? (before.mrp === null ? null : Number(before.mrp)) : input.mrp,
      gstRate: input.gstRate ?? before.gstRate,
      taxInclusive: input.taxInclusive ?? before.taxInclusive,
    };
    const issues = itemRuleIssues({ ...merged, barcodes: input.barcodes });
    if (issues.length) throw fieldErrors(issues);
    await this.assertReferences(input, id);

    const data: ItemWriteData = input;
    if (!(await this.items.update(id, data))) throw notFound("Item not found");
    const after = await this.getById(auth, id, branchId);

    // Price and tax changes are audited (PRD M12.1).
    const priceFields = ["mrp", "salePrice", "purchasePrice", "gstRate", "taxInclusive"] as const;
    if (priceFields.some((f) => before[f] !== after[f])) {
      const pick = (i: ItemResponseDto) => Object.fromEntries(priceFields.map((f) => [f, i[f]]));
      await this.audit.record(auth, {
        action: "item.price.update",
        entity: "Item",
        entityId: id,
        before: { sku: before.sku, ...pick(before) },
        after: { sku: after.sku, ...pick(after) },
      });
    }
    return after;
  }

  async remove(auth: AuthContext, id: string): Promise<void> {
    const before = await this.items.findById(id);
    if (!before) throw notFound("Item not found");
    if (await this.items.hasStock(id)) {
      throw conflict(
        `${before.name} still has stock, reservations or transfers in a branch. Adjust them to zero first.`,
      );
    }
    await this.items.softDelete(id);
    await this.audit.record(auth, { action: "item.delete", entity: "Item", entityId: id, before });
  }

  // SKU and barcodes must be free among active items; category, brand and models must exist.
  private async assertReferences(input: UpdateItemDto, excludeId?: string) {
    const issues: Issue[] = [];
    if (input.sku) {
      const owner = await this.items.findSkuOwner(input.sku, excludeId);
      if (owner) issues.push({ path: "sku", message: `SKU ${input.sku} is already used by ${owner.name}` });
    }
    if (input.barcodes?.length) {
      const taken = await this.items.findBarcodeOwners(input.barcodes, excludeId);
      if (taken[0])
        issues.push({ path: "barcodes", message: `Barcode ${taken[0].code} is already on ${taken[0].itemName}` });
    }
    if (input.categoryId && !(await this.catalog.findById("categories", input.categoryId))) {
      issues.push({ path: "categoryId", message: "Choose a category" });
    }
    if (input.brandId && !(await this.catalog.findById("brands", input.brandId))) {
      issues.push({ path: "brandId", message: "Choose a brand" });
    }
    const models = [...new Set(input.compatibleModelIds ?? [])];
    if (models.length && (await this.items.countActiveModels(models)) !== models.length) {
      issues.push({ path: "compatibleModelIds", message: "One of the vehicle models no longer exists" });
    }
    if (issues.length) throw fieldErrors(issues);
  }
}
