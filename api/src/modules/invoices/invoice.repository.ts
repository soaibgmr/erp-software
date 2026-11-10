import { inject, injectable } from "inversify";
import { Prisma, PrismaClient } from "@prisma/client";
import { toMilli, toPaise, type InvoiceStatus, type PaymentMethod } from "@automobile/shared";
import { TYPES } from "../../config/ioc.types";
import type { Paginated } from "../../common/pagination";
import type { Db } from "../../common/prisma-types";
import { loadUserNames, type UserRef } from "../../common/user-names";
import type { IInvoiceRepository } from "./interfaces/iinvoice.repository";
import type {
  CreateCreditNoteData,
  CreateInvoiceData,
  CreatePaymentData,
  CreditableLine,
  CreditNoteDto,
  InvoiceDetailDto,
  InvoiceListFilter,
  InvoiceSummaryDto,
  ListCreditNotesQuery,
  LockedInvoice,
  PaymentDto,
  SaleItemRow,
  SaleLabourRow,
  StoredInvoiceStatus,
} from "./invoice.types";

type Dec = Prisma.Decimal;
const money = (d: Dec | null | undefined) => (d == null ? null : d.toFixed(2));
const m2 = (d: Dec) => d.toFixed(2);
const paise = (d: Dec | string | number) => toPaise(d.toString());
const OPEN_STATUSES: StoredInvoiceStatus[] = ["UNPAID", "PARTIALLY_PAID"];

const summarySelect = {
  id: true,
  number: true,
  kind: true,
  invoiceDate: true,
  dueDate: true,
  status: true,
  customerId: true,
  customerName: true,
  customerMobile: true,
  grandTotal: true,
  paidTotal: true,
  creditedTotal: true,
  branch: { select: { id: true, code: true, name: true } },
  _count: { select: { lines: true } },
  payments: { where: { kind: null }, select: { mode: true }, distinct: ["mode"] },
} satisfies Prisma.InvoiceSelect;

type SummaryRow = Prisma.InvoiceGetPayload<{ select: typeof summarySelect }>;

// OVERDUE isn't stored: an open invoice past its due date reads as overdue.
function displayStatus(status: StoredInvoiceStatus, dueDate: Date | null, now = new Date()): InvoiceStatus {
  return OPEN_STATUSES.includes(status) && dueDate && dueDate < now ? "OVERDUE" : status;
}

function toSummary(r: SummaryRow): InvoiceSummaryDto {
  const balance = r.grandTotal.minus(r.creditedTotal).minus(r.paidTotal);
  return {
    id: r.id,
    number: r.number,
    kind: r.kind,
    branch: r.branch,
    invoiceDate: r.invoiceDate,
    dueDate: r.dueDate,
    status: displayStatus(r.status, r.dueDate),
    customerId: r.customerId,
    customerName: r.customerName,
    customerMobile: r.customerMobile,
    itemCount: r._count.lines,
    grandTotal: m2(r.grandTotal),
    paidTotal: m2(r.paidTotal),
    creditedTotal: m2(r.creditedTotal),
    balanceDue: r.status === "CANCELLED" ? "0.00" : (balance.isNegative() ? new Prisma.Decimal(0) : balance).toFixed(2),
    paymentModes: r.payments.map((p) => p.mode as PaymentMethod),
  };
}

@injectable()
export class InvoiceRepository implements IInvoiceRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  // ---------- Pricing lookups ----------

  async findSaleItems(ids: string[], branchId: string): Promise<SaleItemRow[]> {
    if (!ids.length) return [];
    const rows = await this.prisma.item.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
        hsnCode: true,
        gstRate: true,
        salePrice: true,
        purchasePrice: true,
        taxInclusive: true,
        isActive: true,
        stock: { where: { branchId }, select: { onHand: true, reserved: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      sku: r.sku,
      name: r.name,
      unit: r.unit,
      hsnCode: r.hsnCode,
      gstRate: Number(r.gstRate),
      salePrice: Number(r.salePrice),
      purchasePrice: Number(r.purchasePrice),
      taxInclusive: r.taxInclusive,
      isActive: r.isActive,
      available: r.stock[0]
        ? (toMilli(r.stock[0].onHand.toString()) - toMilli(r.stock[0].reserved.toString())) / 1000
        : null,
    }));
  }

  async findSaleLabour(ids: string[]): Promise<SaleLabourRow[]> {
    if (!ids.length) return [];
    const rows = await this.prisma.labourService.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, name: true, sacCode: true, gstRate: true, rate: true, isActive: true },
    });
    return rows.map((r) => ({ ...r, gstRate: Number(r.gstRate), rate: Number(r.rate) }));
  }

  async customerOutstanding(customerId: string): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ due: string | null }[]>`
      SELECT COALESCE(SUM(grand_total - credited_total - paid_total), 0)::text AS due
        FROM invoices
       WHERE customer_id = ${customerId}::uuid AND status IN ('UNPAID', 'PARTIALLY_PAID')`;
    return Math.max(toPaise(row?.due ?? "0"), 0);
  }

  // ---------- Invoices ----------

  create(db: Db, { lines, ...data }: CreateInvoiceData) {
    return db.invoice.create({ data: { ...data, lines: { create: lines } }, select: { id: true } });
  }

  async findDetail(id: string): Promise<InvoiceDetailDto | null> {
    const r = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, code: true, name: true } },
        lines: { orderBy: { lineNo: "asc" } },
        payments: { orderBy: { receivedAt: "asc" } },
        creditNotes: { orderBy: { createdAt: "asc" } },
        _count: { select: { lines: true } },
      },
    });
    if (!r) return null;

    const users = await loadUserNames(this.prisma, [
      r.createdById,
      r.cancelledById,
      r.discountApprovedById,
      r.creditApprovedById,
      ...r.payments.map((p) => p.createdById),
    ]);
    const user = (id: string | null): UserRef | null => (id && users.get(id)) || null;
    const reversedIds = new Set(r.payments.flatMap((p) => (p.reversesPaymentId ? [p.reversesPaymentId] : [])));

    const payments: PaymentDto[] = r.payments.map((p) => ({
      id: p.id,
      invoiceId: p.invoiceId,
      mode: p.mode as PaymentMethod,
      amount: m2(p.amount),
      tendered: money(p.tendered),
      reference: p.reference,
      note: p.note,
      kind: (p.kind as "REVERSAL" | "REFUND" | null) ?? "RECEIPT",
      reversesPaymentId: p.reversesPaymentId,
      reversed: reversedIds.has(p.id),
      receivedAt: p.receivedAt,
      createdBy: user(p.createdById),
    }));

    return {
      ...toSummary({
        ...r,
        payments: [...new Set(r.payments.filter((p) => !p.kind).map((p) => p.mode))].map((mode) => ({ mode })),
      }),
      customerGstin: r.customerGstin,
      customerAddress: r.customerAddress,
      placeOfSupply: r.placeOfSupply,
      supplyType: r.supplyType,
      grossTotal: m2(r.grossTotal),
      discountTotal: m2(r.discountTotal),
      billDiscountType: r.billDiscountType,
      billDiscountValue: money(r.billDiscountValue),
      taxableTotal: m2(r.taxableTotal),
      cgstTotal: m2(r.cgstTotal),
      sgstTotal: m2(r.sgstTotal),
      igstTotal: m2(r.igstTotal),
      roundOff: m2(r.roundOff),
      notes: r.notes,
      shiftId: r.shiftId,
      createdBy: user(r.createdById),
      cancelledAt: r.cancelledAt,
      cancelledBy: user(r.cancelledById),
      cancelReason: r.cancelReason,
      discountApprovedBy: user(r.discountApprovedById),
      creditApprovedBy: user(r.creditApprovedById),
      lines: r.lines.map((l) => ({
        id: l.id,
        lineNo: l.lineNo,
        kind: l.kind,
        itemId: l.itemId,
        labourServiceId: l.labourServiceId,
        description: l.description,
        sku: l.sku,
        hsnSac: l.hsnSac,
        unit: l.unit,
        quantity: l.quantity.toFixed(3),
        rate: m2(l.rate),
        taxInclusive: l.taxInclusive,
        gstRate: Number(l.gstRate),
        discount: m2(l.lineDiscount.plus(l.billDiscount)),
        taxable: m2(l.taxable),
        cgst: m2(l.cgst),
        sgst: m2(l.sgst),
        igst: m2(l.igst),
        total: m2(l.total),
        returnedQty: l.returnedQty.toFixed(3),
      })),
      payments,
      creditNotes: r.creditNotes.map((c) => ({
        id: c.id,
        number: c.number,
        reason: c.reason,
        total: m2(c.total),
        refunded: m2(c.refunded),
        createdAt: c.createdAt,
      })),
      createdAt: r.createdAt,
    };
  }

  async list(f: InvoiceListFilter): Promise<Paginated<InvoiceSummaryDto>> {
    const now = new Date();
    const and: Prisma.InvoiceWhereInput[] = [{ branchId: { in: f.branchIds } }];
    if (f.customerId) and.push({ customerId: f.customerId });
    if (f.kind) and.push({ kind: f.kind });
    if (f.from) and.push({ invoiceDate: { gte: f.from } });
    if (f.to) and.push({ invoiceDate: { lt: f.to } });
    if (f.paymentMode) and.push({ payments: { some: { mode: f.paymentMode, kind: null } } });
    if (f.status === "OVERDUE") and.push({ status: { in: OPEN_STATUSES }, dueDate: { lt: now } });
    else if (f.status === "UNPAID" || f.status === "PARTIALLY_PAID") {
      and.push({ status: f.status, OR: [{ dueDate: null }, { dueDate: { gte: now } }] });
    } else if (f.status) and.push({ status: f.status });
    if (f.search) {
      const digits = f.search.replace(/\D/g, "");
      and.push({
        OR: [
          { number: { contains: f.search, mode: "insensitive" } },
          { customerName: { contains: f.search, mode: "insensitive" } },
          ...(digits.length >= 3 ? [{ customerMobile: { contains: digits } }] : []),
        ],
      });
    }
    const where: Prisma.InvoiceWhereInput = { AND: and };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        select: summarySelect,
        orderBy: [{ invoiceDate: "desc" }, { number: "desc" }],
        skip: (f.page - 1) * f.limit,
        take: f.limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { data: rows.map(toSummary), page: f.page, limit: f.limit, total };
  }

  async lockInvoice(db: Db, id: string): Promise<LockedInvoice | null> {
    const rows = await db.$queryRaw<
      {
        id: string;
        number: string;
        branchId: string;
        customerId: string | null;
        status: StoredInvoiceStatus;
        grandTotal: string;
        paidTotal: string;
        creditedTotal: string;
        supplyType: "INTRA_STATE" | "INTER_STATE";
      }[]
    >`
      SELECT id, number, branch_id AS "branchId", customer_id AS "customerId", status::text AS status,
             grand_total::text AS "grandTotal", paid_total::text AS "paidTotal",
             credited_total::text AS "creditedTotal", supply_type::text AS "supplyType"
        FROM invoices WHERE id = ${id}::uuid FOR UPDATE`;
    const r = rows[0];
    return (
      r && {
        ...r,
        grandTotal: toPaise(r.grandTotal),
        paidTotal: toPaise(r.paidTotal),
        creditedTotal: toPaise(r.creditedTotal),
      }
    );
  }

  async updateTotals(db: Db, id: string, d: { paidPaise: number; creditedPaise: number; status: StoredInvoiceStatus }) {
    await db.invoice.update({
      where: { id },
      data: {
        paidTotal: (d.paidPaise / 100).toFixed(2),
        creditedTotal: (d.creditedPaise / 100).toFixed(2),
        status: d.status,
      },
    });
  }

  async markCancelled(db: Db, id: string, userId: string, reason: string) {
    await db.invoice.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: userId, cancelReason: reason },
    });
  }

  // ---------- Payments ----------

  createPayment(db: Db, data: CreatePaymentData) {
    return db.payment.create({ data, select: { id: true } });
  }

  async findPayment(id: string) {
    const p = await this.prisma.payment.findUnique({
      where: { id },
      select: { id: true, invoiceId: true, branchId: true, mode: true, amount: true, kind: true },
    });
    if (!p) return null;
    const reversal = await this.prisma.payment.findUnique({ where: { reversesPaymentId: id }, select: { id: true } });
    return { ...p, amountPaise: paise(p.amount), reversed: Boolean(reversal) };
  }

  async paymentsByMode(db: Db, invoiceId: string) {
    const rows = await db.payment.groupBy({ by: ["mode"], where: { invoiceId }, _sum: { amount: true } });
    return rows.map((r) => ({ mode: r.mode, amountPaise: paise(r._sum.amount ?? 0) }));
  }

  // ---------- Credit notes ----------

  async creditableLines(db: Db, invoiceId: string): Promise<CreditableLine[]> {
    const lines = await db.invoiceLine.findMany({ where: { invoiceId }, orderBy: { lineNo: "asc" } });
    const credited = await db.creditNoteLine.groupBy({
      by: ["invoiceLineId"],
      where: { invoiceLineId: { in: lines.map((l) => l.id) } },
      _sum: { taxable: true, cgst: true, sgst: true, igst: true },
    });
    const byLine = new Map(credited.map((c) => [c.invoiceLineId, c._sum]));
    return lines.map((l) => {
      const c = byLine.get(l.id);
      return {
        id: l.id,
        kind: l.kind,
        itemId: l.itemId,
        description: l.description,
        quantity: toMilli(l.quantity.toString()),
        returned: toMilli(l.returnedQty.toString()),
        unitCost: l.unitCost == null ? null : Number(l.unitCost),
        taxablePaise: paise(l.taxable),
        cgstPaise: paise(l.cgst),
        sgstPaise: paise(l.sgst),
        igstPaise: paise(l.igst),
        credited: {
          taxablePaise: paise(c?.taxable ?? 0),
          cgstPaise: paise(c?.cgst ?? 0),
          sgstPaise: paise(c?.sgst ?? 0),
          igstPaise: paise(c?.igst ?? 0),
        },
      };
    });
  }

  createCreditNote(db: Db, { lines, ...data }: CreateCreditNoteData) {
    return db.creditNote.create({ data: { ...data, lines: { create: lines } }, select: { id: true } });
  }

  async addReturned(db: Db, invoiceLineId: string, quantityMilli: number) {
    await db.invoiceLine.update({
      where: { id: invoiceLineId },
      data: { returnedQty: { increment: (quantityMilli / 1000).toFixed(3) } },
    });
  }

  async setCreditNoteRefund(db: Db, id: string, refundedPaise: number) {
    await db.creditNote.update({ where: { id }, data: { refunded: (refundedPaise / 100).toFixed(2) } });
  }

  async findCreditNote(id: string): Promise<CreditNoteDto | null> {
    const [row] = await this.creditNoteRows({ id });
    return row ?? null;
  }

  async listCreditNotes(branchIds: string[], q: ListCreditNotesQuery): Promise<Paginated<CreditNoteDto>> {
    const where: Prisma.CreditNoteWhereInput = { branchId: { in: branchIds }, invoiceId: q.invoiceId };
    const [data, total] = await Promise.all([
      this.creditNoteRows(where, (q.page - 1) * q.limit, q.limit),
      this.prisma.creditNote.count({ where }),
    ]);
    return { data, page: q.page, limit: q.limit, total };
  }

  countCreditNotes(invoiceId: string) {
    return this.prisma.creditNote.count({ where: { invoiceId } });
  }

  private async creditNoteRows(where: Prisma.CreditNoteWhereInput, skip = 0, take = 1): Promise<CreditNoteDto[]> {
    const rows = await this.prisma.creditNote.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: { invoice: { select: { id: true, number: true, customerName: true } }, lines: true },
    });
    const lineIds = rows.flatMap((r) => r.lines.map((l) => l.invoiceLineId));
    const [users, originals] = await Promise.all([
      loadUserNames(
        this.prisma,
        rows.map((r) => r.createdById),
      ),
      lineIds.length ? this.prisma.invoiceLine.findMany({ where: { id: { in: lineIds } } }) : [],
    ]);
    const original = new Map(originals.map((l) => [l.id, l]));
    return rows.map((r) => ({
      id: r.id,
      number: r.number,
      branchId: r.branchId,
      invoice: r.invoice,
      reason: r.reason,
      taxableTotal: m2(r.taxableTotal),
      cgstTotal: m2(r.cgstTotal),
      sgstTotal: m2(r.sgstTotal),
      igstTotal: m2(r.igstTotal),
      roundOff: m2(r.roundOff),
      total: m2(r.total),
      refunded: m2(r.refunded),
      createdBy: (r.createdById && users.get(r.createdById)) || null,
      createdAt: r.createdAt,
      lines: r.lines.map((l) => {
        const o = original.get(l.invoiceLineId);
        return {
          invoiceLineId: l.invoiceLineId,
          description: o?.description ?? "",
          sku: o?.sku ?? null,
          hsnSac: o?.hsnSac ?? null,
          unit: o?.unit ?? "PCS",
          quantity: l.quantity.toFixed(3),
          rate: o ? m2(o.rate) : "0.00",
          gstRate: o ? Number(o.gstRate) : 0,
          taxable: m2(l.taxable),
          cgst: m2(l.cgst),
          sgst: m2(l.sgst),
          igst: m2(l.igst),
          total: m2(l.total),
        };
      }),
    }));
  }

  // ---------- Reliability ----------

  findIdempotency(userId: string, key: string) {
    return this.prisma.idempotencyKey.findUnique({
      where: { userId_key: { userId, key } },
      select: { scope: true, requestHash: true, resourceId: true },
    });
  }

  async saveIdempotency(
    db: Db,
    data: { userId: string; key: string; scope: string; requestHash: string; resourceId: string },
  ) {
    await db.idempotencyKey.create({ data });
  }

  async addOutboxEvent(db: Db, type: string, payload: Record<string, unknown>) {
    await db.outboxEvent.create({ data: { type, payload: payload as Prisma.InputJsonValue } });
  }
}
