import { inject, injectable } from "inversify";
import { amountInWords, toPaise, type PaymentMethod } from "@erp-software/shared";
import { TYPES } from "../../config/ioc.types";
import { env } from "../../config/env";
import { canAccessBranch, type AuthContext } from "../../common/auth-context";
import { badRequest, conflict, forbidden, notFound } from "../../common/http-error";
import type { Paginated } from "../../common/pagination";
import type { IUnitOfWork } from "../../common/unit-of-work";
import { addDays, startOfDayIn } from "../../utils/time";
import type { IAuditService } from "../audit/interfaces/iaudit.service";
import type { IBranchRepository } from "../branches/interfaces/ibranch.repository";
import type { IBusinessRepository } from "../business/interfaces/ibusiness.repository";
import type { IShiftService } from "../shifts/interfaces/ishift.service";
import type { IStockService } from "../stock/interfaces/istock.service";
import type { IInvoiceRepository } from "./interfaces/iinvoice.repository";
import type { IInvoiceService } from "./interfaces/iinvoice.service";
import type { InvoiceDetailDto, InvoicePrintDto, InvoiceSummaryDto, ListInvoicesQuery } from "./invoice.types";

@injectable()
export class InvoiceService implements IInvoiceService {
  constructor(
    @inject(TYPES.UnitOfWork) private readonly uow: IUnitOfWork,
    @inject(TYPES.InvoiceRepository) private readonly invoices: IInvoiceRepository,
    @inject(TYPES.StockService) private readonly stock: IStockService,
    @inject(TYPES.ShiftService) private readonly shifts: IShiftService,
    @inject(TYPES.BranchRepository) private readonly branches: IBranchRepository,
    @inject(TYPES.BusinessRepository) private readonly business: IBusinessRepository,
    @inject(TYPES.AuditService) private readonly audit: IAuditService,
  ) {}

  async list(
    auth: AuthContext,
    currentBranchId: string | undefined,
    query: ListInvoicesQuery,
  ): Promise<Paginated<InvoiceSummaryDto>> {
    const { branchId: requested, from, to, ...rest } = query;
    let branchIds: string[];
    if (requested === "all") {
      const branches = await this.branches.list(auth.businessId, { includeInactive: true, ids: auth.branchIds });
      branchIds = branches.map((b) => b.id);
    } else {
      const id = requested ?? currentBranchId;
      if (!id) throw badRequest("Choose a branch");
      if (!canAccessBranch(auth, id)) throw forbidden("You don't have access to this branch");
      branchIds = [id];
    }
    // Dates are calendar days in the business timezone; `to` is inclusive.
    const tz = env.APP_TIMEZONE;
    return this.invoices.list({
      ...rest,
      branchIds,
      from: from ? startOfDayIn(from, tz) : undefined,
      to: to ? addDays(startOfDayIn(to, tz), 1) : undefined,
    });
  }

  async getById(auth: AuthContext, id: string): Promise<InvoiceDetailDto> {
    const invoice = await this.invoices.findDetail(id);
    if (!invoice || !canAccessBranch(auth, invoice.branch.id)) throw notFound("Invoice not found");
    return invoice;
  }

  async print(auth: AuthContext, id: string): Promise<InvoicePrintDto> {
    const invoice = await this.getById(auth, id);
    if (invoice.kind === "OPENING_BALANCE")
      throw badRequest(`${invoice.number} is old dues, not a tax invoice; there is nothing to print`);
    const [business, branch] = await Promise.all([
      this.business.get(auth.businessId),
      this.branches.findById(auth.businessId, invoice.branch.id),
    ]);

    // HSN-wise tax summary, as printed under the lines.
    const groups = new Map<
      string,
      { gstRate: number; hsnSac: string | null; taxable: number; cgst: number; sgst: number; igst: number }
    >();
    for (const l of invoice.lines) {
      const key = `${l.hsnSac ?? ""}|${l.gstRate}`;
      const g = groups.get(key) ?? { gstRate: l.gstRate, hsnSac: l.hsnSac, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
      g.taxable += toPaise(l.taxable);
      g.cgst += toPaise(l.cgst);
      g.sgst += toPaise(l.sgst);
      g.igst += toPaise(l.igst);
      groups.set(key, g);
    }
    const r = (p: number) => (p / 100).toFixed(2);
    return {
      invoice,
      business: (business ?? {}) as Record<string, unknown>,
      branch: (branch ?? {}) as Record<string, unknown>,
      amountInWords: amountInWords(invoice.grandTotal),
      taxSummary: [...groups.values()]
        .sort((a, b) => (a.hsnSac ?? "").localeCompare(b.hsnSac ?? "") || a.gstRate - b.gstRate)
        .map((g) => ({
          gstRate: g.gstRate,
          hsnSac: g.hsnSac,
          taxable: r(g.taxable),
          cgst: r(g.cgst),
          sgst: r(g.sgst),
          igst: r(g.igst),
        })),
    };
  }

  async cancel(auth: AuthContext, id: string, reason: string): Promise<InvoiceDetailDto> {
    const before = await this.getById(auth, id);
    if (before.status === "CANCELLED") throw conflict(`${before.number} is already cancelled`);
    // Old dues have no stock to return; money collected must be reversed first so nothing is "refunded".
    if (before.kind === "OPENING_BALANCE" && Number(before.paidTotal) > 0)
      throw conflict(`${before.number} has payments; reverse them before cancelling these old dues`);
    if (before.creditNotes.length)
      throw conflict(`${before.number} has credit notes; return the remaining items with another credit note instead`);
    const shiftId = await this.shifts.findOpenId(before.branch.id, auth.userId);

    await this.uow.run(async (tx) => {
      const inv = await this.invoices.lockInvoice(tx, id);
      if (!inv || inv.status === "CANCELLED") throw conflict(`${before.number} is already cancelled`);

      // Stock comes back through new ledger rows; the sale rows stay.
      await this.stock.post(
        tx,
        auth,
        before.lines
          .filter((l) => l.kind === "ITEM" && l.itemId)
          .map((l) => ({
            branchId: inv.branchId,
            itemId: l.itemId!,
            type: "SALE_CANCEL" as const,
            quantity: Number(l.quantity) - Number(l.returnedQty),
            refType: "Invoice",
            refId: id,
            refNo: inv.number,
            note: reason,
          })),
        { allowNegative: true },
      );

      // Money taken is refunded by the method it came in.
      for (const { mode, amountPaise } of await this.invoices.paymentsByMode(tx, id)) {
        if (amountPaise <= 0) continue;
        await this.invoices.createPayment(tx, {
          invoiceId: id,
          branchId: inv.branchId,
          shiftId,
          mode: mode as PaymentMethod,
          amount: (-amountPaise / 100).toFixed(2),
          kind: "REFUND",
          note: `Refund on cancellation: ${reason}`,
          createdById: auth.userId,
        });
      }
      await this.invoices.markCancelled(tx, id, auth.userId, reason);
      await this.invoices.updateTotals(tx, id, { paidPaise: 0, creditedPaise: inv.creditedTotal, status: "CANCELLED" });
      await this.invoices.addOutboxEvent(tx, auth.businessId, "InvoiceCancelled", {
        invoiceId: id,
        number: inv.number,
        branchId: inv.branchId,
      });
      await this.audit.record(
        auth,
        {
          action: "invoice.cancel",
          entity: "Invoice",
          entityId: id,
          branchId: inv.branchId,
          before: {
            number: before.number,
            status: before.status,
            grandTotal: before.grandTotal,
            paidTotal: before.paidTotal,
          },
          after: { status: "CANCELLED", reason, refunded: before.paidTotal },
        },
        tx,
      );
    });
    return this.getById(auth, id);
  }
}
