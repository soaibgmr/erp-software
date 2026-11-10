import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { defaultSettings, fromMilli, toMilli, type SettingsGroup } from "@erp-software/shared";
import { HttpError } from "../common/http-error";
import type { Db } from "../common/prisma-types";
import type { IUnitOfWork } from "../common/unit-of-work";
import { authFor, branch, FakeAudit, ids, stub } from "../test/fakes";
import type { IBranchRepository } from "./branches/interfaces/ibranch.repository";
import type { ICatalogRepository } from "./catalog/interfaces/icatalog.repository";
import type { IDocumentSequenceService } from "./document-sequences/interfaces/idocument-sequence.service";
import type { IItemRepository } from "./items/interfaces/iitem.repository";
import { ItemService } from "./items/item.service";
import type { ItemResponseDto } from "./items/item.types";
import type { ISettingsService } from "./settings/interfaces/isettings.service";
import type { IStockDocumentRepository } from "./stock/interfaces/istock-document.repository";
import type { IStockRepository } from "./stock/interfaces/istock.repository";
import type { IStockService } from "./stock/interfaces/istock.service";
import { StockAdjustmentService } from "./stock/stock-adjustment.service";
import { StockImportService } from "./stock/stock-import.service";
import { StockService } from "./stock/stock.service";
import { StockTransferService } from "./stock/stock-transfer.service";
import type { CreateAdjustmentData, LedgerInsert, StockMovement } from "./stock/stock.types";

async function expectHttp(promise: Promise<unknown>, status: number) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(HttpError);
  expect((err as HttpError).status).toBe(status);
  return err as HttpError;
}

const tx = {} as Db;
const uow: IUnitOfWork = { run: (work) => work(tx) };
const item1 = "40000000-0000-4000-8000-000000000001";
const item2 = "40000000-0000-4000-8000-000000000002";

function settings(overrides: { allowNegativeStock?: boolean; adjustmentApprovalLimit?: number } = {}) {
  return stub<ISettingsService>({
    get: async (_businessId: string, group: SettingsGroup) => {
      const value = defaultSettings(group) as Record<string, unknown>;
      if (group === "pos" && overrides.allowNegativeStock !== undefined)
        value.allowNegativeStock = overrides.allowNegativeStock;
      if (group === "inventory" && overrides.adjustmentApprovalLimit !== undefined)
        value.adjustmentApprovalLimit = overrides.adjustmentApprovalLimit;
      return value as never;
    },
  });
}

// In-memory branch_stock + ledger with the same contract as StockRepository.
class FakeStockRepo {
  balances = new Map<string, { onHand: number; reserved: number; inTransit: number }>();
  ledger: LedgerInsert[] = [];
  key = (b: string, i: string) => `${b}:${i}`;

  repo(): IStockRepository {
    return stub<IStockRepository>({
      lockBalances: async (_db, pairs) =>
        pairs.map((p) => {
          const k = this.key(p.branchId, p.itemId);
          if (!this.balances.has(k)) this.balances.set(k, { onHand: 0, reserved: 0, inTransit: 0 });
          const b = this.balances.get(k)!;
          return {
            ...p,
            sku: p.itemId.slice(-3),
            name: `Item ${p.itemId.slice(-1)}`,
            onHand: b.onHand,
            reserved: b.reserved,
          };
        }),
      insertLedger: async (_db, rows) => {
        this.ledger.push(...rows);
      },
      setOnHand: async (_db, branchId, itemId, onHand) => {
        this.balances.get(this.key(branchId, itemId))!.onHand = onHand;
      },
      addInTransit: async (_db, branchId, itemId, delta) => {
        const k = this.key(branchId, itemId);
        const b = this.balances.get(k) ?? { onHand: 0, reserved: 0, inTransit: 0 };
        b.inTransit = Math.max(b.inTransit + delta, 0);
        this.balances.set(k, b);
      },
      findLineItems: async (_businessId, idList) =>
        idList
          .filter((id) => [item1, item2].includes(id))
          .map((id) => ({
            id,
            sku: id.slice(-3),
            name: `Item ${id.slice(-1)}`,
            unit: "PCS" as const,
            purchasePrice: "100.00",
          })),
    });
  }
}

function stockService(fake: FakeStockRepo) {
  return new StockService(fake.repo(), stub<IBranchRepository>({}), new FakeAudit());
}
const strict = { allowNegative: false };

const move = (quantity: number, itemId = item1, branchId = ids.branchA): StockMovement => ({
  branchId,
  itemId,
  type: "ADJUSTMENT",
  quantity,
});

describe("StockService.post (ledger)", () => {
  it("keeps on hand equal to the sum of the ledger after random movements", async () => {
    const fake = new FakeStockRepo();
    const svc = stockService(fake);
    let seed = 42;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;

    for (let i = 0; i < 400; i++) {
      const batch = Array.from({ length: 1 + Math.floor(rand() * 3) }, () =>
        move(
          Math.round((rand() * 20 - 8) * 1000) / 1000,
          rand() < 0.5 ? item1 : item2,
          rand() < 0.5 ? ids.branchA : ids.branchB,
        ),
      );
      // Some batches fail (would go negative); a failed batch must not change anything visible to the next one.
      const before = structuredClone([...fake.balances]);
      const ledgerBefore = fake.ledger.length;
      try {
        await svc.post(tx, { userId: ids.owner }, batch, strict);
      } catch (e) {
        expect((e as HttpError).status).toBe(409);
        fake.balances = new Map(before); // what the DB rollback does
        fake.ledger.length = ledgerBefore;
      }
    }

    for (const [k, b] of fake.balances) {
      const [branchId, itemId] = k.split(":");
      const sum = fake.ledger
        .filter((l) => l.branchId === branchId && l.itemId === itemId)
        .reduce((s, l) => s + toMilli(l.quantity), 0);
      expect(b.onHand).toBe(sum);
      expect(b.onHand).toBeGreaterThanOrEqual(0);
    }
    expect(fake.ledger.length).toBeGreaterThan(100);
  });

  it("writes a running balance on every row, including two moves of the same item", async () => {
    const fake = new FakeStockRepo();
    await stockService(fake).post(tx, { userId: ids.owner }, [move(5), move(-2), move(1.5)], strict);
    expect(fake.ledger.map((l) => [l.quantity, l.balanceAfter])).toEqual([
      ["5.000", "5.000"],
      ["-2.000", "3.000"],
      ["1.500", "4.500"],
    ]);
  });

  it("blocks negative availability, counting reserved stock", async () => {
    const fake = new FakeStockRepo();
    fake.balances.set(fake.key(ids.branchA, item1), { onHand: 5000, reserved: 3000, inTransit: 0 });
    const err = await expectHttp(stockService(fake).post(tx, { userId: ids.owner }, [move(-3)], strict), 409);
    expect(err.message).toContain("2 available");
  });

  it("allows negative stock when the caller says so", async () => {
    const fake = new FakeStockRepo();
    await stockService(fake).post(tx, { userId: ids.owner }, [move(-2), move(-1)], { allowNegative: true });
    expect(fromMilli(fake.balances.get(fake.key(ids.branchA, item1))!.onHand)).toBe(-3);
  });

  it("ignores zero-quantity movements", async () => {
    const fake = new FakeStockRepo();
    await stockService(fake).post(tx, { userId: ids.owner }, [move(0)], strict);
    expect(fake.ledger).toHaveLength(0);
  });
});

function adjustmentService(limit: number) {
  const fake = new FakeStockRepo();
  fake.balances.set(fake.key(ids.branchA, item1), { onHand: 100_000, reserved: 0, inTransit: 0 });
  const created: CreateAdjustmentData[] = [];
  const decided: string[] = [];
  const docs = stub<IStockDocumentRepository>({
    createAdjustment: async (_db, data) => {
      created.push(data);
      return { id: "adj-1" };
    },
    findAdjustment: async () => ({
      id: "adj-1",
      number: created[0]!.number,
      branchId: ids.branchA,
      reason: created[0]!.reason,
      note: null,
      status: (decided.length ? "POSTED" : created[0]!.status) as "PENDING",
      totalValue: created[0]!.totalValue,
      lineCount: 1,
      createdBy: { id: ids.counter, name: "Counter" },
      decidedBy: null,
      decidedAt: null,
      decisionNote: null,
      createdAt: new Date(),
      lines: created[0]!.lines.map((l) => ({ ...l, sku: "001", name: "Item 1", unit: "PCS" as const, value: "0" })),
    }),
    decideAdjustment: async (_db, _id, to) => {
      decided.push(to);
      return true;
    },
  });
  const sequences = stub<IDocumentSequenceService>({
    next: async () => ({ number: "ADJ-26-00001", sequence: 1, financialYear: 2026 }),
  });
  const stock = stockService(fake);
  const svc = new StockAdjustmentService(
    uow,
    stock,
    fake.repo(),
    docs,
    sequences,
    settings({ adjustmentApprovalLimit: limit }),
    new FakeAudit(),
  );
  return { svc, fake, created, decided };
}

describe("StockAdjustmentService approval", () => {
  // 30 × ₹100 = ₹3,000
  const input = { reason: "DAMAGE" as const, note: null, lines: [{ itemId: item1, quantity: -30 }] };
  const storekeeper = {
    ...authFor("counter"),
    permissions: [...authFor("counter").permissions, "inventory.manage" as const],
  };

  it("posts at once when the value is within the limit", async () => {
    const { svc, fake, created } = adjustmentService(5000);
    await svc.create(storekeeper, ids.branchA, input);
    expect(created[0]!.status).toBe("POSTED");
    expect(created[0]!.totalValue).toBe("3000.00");
    expect(fake.ledger).toHaveLength(1);
  });

  it("waits for approval above the limit, without touching stock", async () => {
    const { svc, fake, created } = adjustmentService(1000);
    await svc.create(storekeeper, ids.branchA, input);
    expect(created[0]!.status).toBe("PENDING");
    expect(fake.ledger).toHaveLength(0);
  });

  it("a user with stock.approve posts above the limit directly", async () => {
    const { svc, created } = adjustmentService(1000);
    await svc.create(authFor("manager"), ids.branchA, input);
    expect(created[0]!.status).toBe("POSTED");
  });

  it("approving a pending adjustment posts its lines", async () => {
    const { svc, fake, decided } = adjustmentService(1000);
    await svc.create(storekeeper, ids.branchA, input);
    await svc.approve(authFor("manager"), ids.branchA, "adj-1");
    expect(decided).toEqual(["POSTED"]);
    expect(fake.ledger.map((l) => l.quantity)).toEqual(["-30.000"]);
  });

  it("opening stock adjustments write OPENING ledger rows", async () => {
    const { svc, fake } = adjustmentService(1_000_000);
    await svc.create(authFor("owner"), ids.branchA, {
      reason: "OPENING_STOCK",
      note: null,
      lines: [{ itemId: item1, quantity: 5 }],
    });
    expect(fake.ledger[0]!.type).toBe("OPENING");
  });

  it("rejects unknown items with a field error", async () => {
    const { svc } = adjustmentService(1000);
    await expectHttp(
      svc.create(authFor("owner"), ids.branchA, {
        reason: "DAMAGE",
        note: null,
        lines: [{ itemId: ids.branchB, quantity: 1 }],
      }),
      400,
    );
  });
});

describe("StockTransferService", () => {
  function transferService() {
    const fake = new FakeStockRepo();
    fake.balances.set(fake.key(ids.branchA, item1), { onHand: 10_000, reserved: 0, inTransit: 0 });
    const docs = stub<IStockDocumentRepository>({
      createTransfer: async () => ({ id: "t-1" }),
      findTransfer: async () => ({
        id: "t-1",
        number: "STR-26-00001",
        status: "IN_TRANSIT",
        fromBranch: { id: ids.branchA, code: "A", name: "Branch A" },
        toBranch: { id: ids.branchB, code: "B", name: "Branch B" },
        note: null,
        lineCount: 1,
        totalQuantity: "4.000",
        createdBy: null,
        closedBy: null,
        closedAt: null,
        createdAt: new Date(),
        lines: [{ itemId: item1, sku: "001", name: "Item 1", unit: "PCS", quantity: "4.000", unitCost: "100.00" }],
      }),
      closeTransfer: async () => true,
    });
    const branches = stub<IBranchRepository>({ findById: async (_businessId, id) => branch(id) });
    const sequences = stub<IDocumentSequenceService>({
      next: async () => ({ number: "STR-26-00001", sequence: 1, financialYear: 2026 }),
    });
    const svc = new StockTransferService(
      uow,
      stockService(fake),
      fake.repo(),
      docs,
      branches,
      sequences,
      new FakeAudit(),
    );
    return { svc, fake };
  }
  const both = authFor("manager", [ids.branchA, ids.branchB]);

  it("moves stock out of the sender and into transit at the receiver", async () => {
    const { svc, fake } = transferService();
    await svc.create(both, ids.branchA, {
      toBranchId: ids.branchB,
      note: null,
      lines: [{ itemId: item1, quantity: 4 }],
    });
    expect(fake.balances.get(fake.key(ids.branchA, item1))!.onHand).toBe(6000);
    expect(fake.balances.get(fake.key(ids.branchB, item1))!.inTransit).toBe(4000);
  });

  it("never lets a transfer push the sender negative, even when negative stock is allowed", async () => {
    const { svc } = transferService();
    await expectHttp(
      svc.create(both, ids.branchA, { toBranchId: ids.branchB, note: null, lines: [{ itemId: item1, quantity: 11 }] }),
      409,
    );
  });

  it("can't transfer to the same branch", async () => {
    const { svc } = transferService();
    await expectHttp(
      svc.create(both, ids.branchA, { toBranchId: ids.branchA, note: null, lines: [{ itemId: item1, quantity: 1 }] }),
      400,
    );
  });

  it("only the receiving branch receives; receiving clears in transit", async () => {
    const { svc, fake } = transferService();
    await svc.create(both, ids.branchA, {
      toBranchId: ids.branchB,
      note: null,
      lines: [{ itemId: item1, quantity: 4 }],
    });
    await expectHttp(svc.receive(both, ids.branchA, "t-1"), 403);
    await svc.receive(both, ids.branchB, "t-1");
    expect(fake.balances.get(fake.key(ids.branchB, item1))).toMatchObject({ onHand: 4000, inTransit: 0 });
  });

  it("only the sender cancels; cancelling returns the stock", async () => {
    const { svc, fake } = transferService();
    await svc.create(both, ids.branchA, {
      toBranchId: ids.branchB,
      note: null,
      lines: [{ itemId: item1, quantity: 4 }],
    });
    await expectHttp(svc.cancel(both, ids.branchB, "t-1"), 403);
    await svc.cancel(both, ids.branchA, "t-1");
    expect(fake.balances.get(fake.key(ids.branchA, item1))!.onHand).toBe(10_000);
    expect(fake.balances.get(fake.key(ids.branchB, item1))!.inTransit).toBe(0);
  });

  it("users without access to either branch can't see a transfer", async () => {
    const { svc } = transferService();
    await expectHttp(svc.getById(authFor("counter", ["20000000-0000-4000-8000-000000000009"]), "t-1"), 404);
  });
});

describe("ItemService", () => {
  const existing: ItemResponseDto = {
    id: item1,
    sku: "OF-1",
    name: "Oil filter",
    oemPartNo: null,
    description: null,
    category: null,
    brand: null,
    hsnCode: null,
    gstRate: 18,
    unit: "PCS",
    mrp: "450.00",
    salePrice: "295.00",
    purchasePrice: "180.00",
    taxInclusive: false,
    isActive: true,
    barcodes: [],
    compatibleModels: [],
    stock: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const items = stub<IItemRepository>({
    findById: async (_businessId, id) => (id === item1 ? existing : null),
    findSkuOwner: async (_businessId, sku) => (sku === "TAKEN" ? { id: item2, name: "Air filter" } : null),
    findBarcodeOwners: async () => [],
    hasStock: async () => true,
  });
  const svc = new ItemService(
    items,
    stub<ICatalogRepository>({ findById: async () => null }),
    stub<IBranchRepository>({}),
    new FakeAudit(),
  );

  it("checks MRP against the stored price when only one side changes", async () => {
    // 400 + 18% = 472 > MRP 450
    const err = await expectHttp(svc.update(authFor("owner"), item1, { salePrice: 400 }), 400);
    expect((err.details as { fieldErrors: Record<string, string[]> }).fieldErrors.salePrice).toBeDefined();
  });

  it("rejects a SKU used by another item", async () => {
    await expectHttp(svc.update(authFor("owner"), item1, { sku: "TAKEN" }), 400);
  });

  it("rejects an unknown brand", async () => {
    await expectHttp(svc.update(authFor("owner"), item1, { brandId: item2 }), 400);
  });

  it("won't delete an item that still has stock", async () => {
    await expectHttp(svc.remove(authFor("owner"), item1), 409);
  });
});

describe("StockImportService", () => {
  function importService() {
    const fake = new FakeStockRepo();
    const repo = stub<IStockRepository>({
      ...fake.repo(),
      findBrandsByNames: async () => [{ id: "b1", name: "Bosch" }],
      findCategoriesByNames: async () => [],
      itemsWithHistory: async () => new Set([item2]),
    } as Partial<IStockRepository>);
    const items = stub<IItemRepository>({
      findBySkus: async () => [
        { id: item2, sku: "EXIST", name: "Existing", purchasePrice: { toString: () => "1" } as never },
      ],
      findBarcodeOwners: async () => [],
    });
    return new StockImportService(uow, stub<IStockService>({}), repo, items, new FakeAudit());
  }

  it("maps friendly headers, flags duplicates and reports per row", async () => {
    const report = await importService().run(authFor("owner"), ids.branchA, {
      commit: false,
      updateExisting: false,
      rows: [
        {
          "Part No": "OEM-1",
          SKU: "new-1",
          "Item Name": "Brake pad",
          Brand: "bosch",
          Category: "Brakes",
          Price: "1,250",
          Qty: "4",
          Colour: "red",
        },
        { SKU: "NEW-1", "Item Name": "Dup", Price: "10" },
        { SKU: "EXIST", "Item Name": "Existing", Price: "10", Qty: "3" },
        { SKU: "BAD", "Item Name": "No price" },
      ],
    });
    expect(report.unknownColumns).toEqual(["Colour"]);
    expect(report.rows.map((r) => r.action)).toEqual(["create", "error", "skip", "error"]);
    expect(report.rows[0]!.openingQty).toBe("4.000");
    expect(report.rows[1]!.errors[0]).toContain("row 2");
    expect(report.rows[2]!.warnings[0]).toContain("already has stock history");
    expect(report.newBrands).toEqual([]);
    expect(report.newCategories).toEqual(["Brakes"]);
  });

  it("refuses to commit while rows have errors", async () => {
    await expectHttp(
      importService().run(authFor("owner"), ids.branchA, {
        commit: true,
        updateExisting: false,
        rows: [{ sku: "X", name: "Y", salePrice: "abc" }],
      }),
      400,
    );
  });

  it("needs the sku, name and salePrice columns", async () => {
    await expectHttp(
      importService().run(authFor("owner"), ids.branchA, {
        commit: false,
        updateExisting: false,
        rows: [{ foo: "1" }],
      }),
      400,
    );
  });
});
