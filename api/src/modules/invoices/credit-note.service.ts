import { inject, injectable } from "inversify";
import { formatQty, fromMilli, milliToDecimal, toMilli } from "@automobile/shared";
import { TYPES } from "../../config/ioc.types";
import { canAccessBranch, type AuthContext } from "../../common/auth-context";
import { badRequest, conflict, fieldErrors, forbidden, notFound } from "../../common/http-error";
import type { Paginated } from "../../common/pagination";
import type { IUnitOfWork } from "../../common/unit-of-work";
import type { IAuditService } from "../audit/interfaces/iaudit.service";
import type { IBranchRepository } from "../branches/interfaces/ibranch.repository";
import type { IDocumentSequenceService } from "../document-sequences/interfaces/idocument-sequence.service";
import type { IShiftService } from "../shifts/interfaces/ishift.service";
import type { IStockService } from "../stock/interfaces/istock.service";
import type { IInvoiceRepository } from "./interfaces/iinvoice.repository";
import type { ICreditNoteService, IInvoiceService } from "./interfaces/iinvoice.service";
import { balanceDue, creditLineAmounts, deriveStatus, roundToRupee } from "./invoice.rules";
import type { CreateCreditNoteDto, CreditNoteDto, ListCreditNotesQuery } from "./invoice.types";

const r2 = (paise: number) => (paise / 100).toFixed(2);

// Sales return: some quantity of posted lines comes back. Stock returns (SALE_RETURN), the invoice
// balance drops by the credit, and anything the customer overpaid is refunded.
@injectable()
export class CreditNoteService implements ICreditNoteService {
  constructor(
    @inject(TYPES.UnitOfWork) private readonly uow: IUnitOfWork,
    @inject(TYPES.InvoiceRepository) private readonly invoices: IInvoiceRepository,
    @inject(TYPES.InvoiceService) private readonly invoiceService: IInvoiceService,
    @inject(TYPES.StockService) private readonly stock: IStockService,
    @inject(TYPES.ShiftService) private readonly shifts: IShiftService,
    @inject(TYPES.DocumentSequenceService) private readonly sequences: IDocumentSequenceService,
    @inject(TYPES.BranchRepository) private readonly branches: IBranchRepository,
    @inject(TYPES.AuditService) private readonly audit: IAuditService,
  ) {}

  async create(auth: AuthContext, input: CreateCreditNoteDto): Promise<CreditNoteDto> {
    const invoice = await this.invoiceService.getById(auth, input.invoiceId);
    if (invoice.status === "CANCELLED") throw conflict(`${invoice.number} is cancelled`);
    if (invoice.kind === "OPENING_BALANCE")
      throw conflict(`${invoice.number} is old dues, not a sale; there are no items to return`);
    const branchId = invoice.branch.id;
    const shiftId = await this.shifts.findOpenId(branchId, auth.userId);

    const id = await this.uow.run(async (tx) => {
      const inv = await this.invoices.lockInvoice(tx, input.invoiceId);
      if (!inv || inv.status === "CANCELLED") throw conflict(`${invoice.number} is cancelled`);
      const lines = new Map((await this.invoices.creditableLines(tx, inv.id)).map((l) => [l.id, l]));

      const issues: { path: string; message: string }[] = [];
      const credit = input.lines.map((req, i) => {
        const line = lines.get(req.invoiceLineId);
        const qty = toMilli(req.quantity);
        if (!line) {
          issues.push({ path: `lines.${i}.invoiceLineId`, message: "Not a line of this invoice" });
          return null;
        }
        const left = line.quantity - line.returned;
        if (qty > left) {
          issues.push({
            path: `lines.${i}.quantity`,
            message: `Only ${formatQty(fromMilli(left))} of ${line.description} can still be returned`,
          });
          return null;
        }
        return { line, qty, amounts: creditLineAmounts(line, qty) };
      });
      if (issues.length) throw fieldErrors(issues);
      const parts = credit.map((c) => c!);

      const sum = (k: "taxablePaise" | "cgstPaise" | "sgstPaise" | "igstPaise" | "totalPaise") =>
        parts.reduce((s, p) => s + p.amounts[k], 0);
      const { totalPaise, roundOffPaise } = roundToRupee(sum("totalPaise"));
      if (totalPaise <= 0) throw badRequest("Nothing to credit");

      const { number } = await this.sequences.next(tx, branchId, "CREDIT_NOTE");
      const { id } = await this.invoices.createCreditNote(tx, {
        number,
        branchId,
        invoiceId: inv.id,
        reason: input.reason,
        taxableTotal: r2(sum("taxablePaise")),
        cgstTotal: r2(sum("cgstPaise")),
        sgstTotal: r2(sum("sgstPaise")),
        igstTotal: r2(sum("igstPaise")),
        roundOff: r2(roundOffPaise),
        total: r2(totalPaise),
        refunded: "0.00",
        createdById: auth.userId,
        lines: parts.map((p) => ({
          invoiceLineId: p.line.id,
          quantity: milliToDecimal(p.qty),
          taxable: r2(p.amounts.taxablePaise),
          cgst: r2(p.amounts.cgstPaise),
          sgst: r2(p.amounts.sgstPaise),
          igst: r2(p.amounts.igstPaise),
          total: r2(p.amounts.totalPaise),
        })),
      });
      for (const p of parts) await this.invoices.addReturned(tx, p.line.id, p.qty);

      // Returned parts go back on the shelf.
      await this.stock.post(
        tx,
        auth,
        parts
          .filter((p) => p.line.kind === "ITEM" && p.line.itemId)
          .map((p) => ({
            branchId,
            itemId: p.line.itemId!,
            type: "SALE_RETURN" as const,
            quantity: fromMilli(p.qty),
            unitCost: p.line.unitCost,
            refType: "CreditNote",
            refId: id,
            refNo: number,
            note: `Return against ${inv.number}`,
          })),
        { allowNegative: true },
      );

      // The credit reduces what is owed; if the customer had paid more than the new total, refund the excess.
      const credited = inv.creditedTotal + totalPaise;
      let paid = inv.paidTotal;
      const over = -balanceDue({ grandTotal: inv.grandTotal, creditedTotal: credited, paidTotal: paid });
      if (over > 0) {
        await this.invoices.createPayment(tx, {
          invoiceId: inv.id,
          branchId,
          shiftId,
          mode: input.refundMode,
          amount: r2(-over),
          kind: "REFUND",
          creditNoteId: id,
          note: `Refund for ${number}`,
          createdById: auth.userId,
        });
        await this.invoices.setCreditNoteRefund(tx, id, over);
        paid -= over;
      }
      await this.invoices.updateTotals(tx, inv.id, {
        paidPaise: paid,
        creditedPaise: credited,
        status: deriveStatus(inv.grandTotal, credited, paid),
      });
      await this.audit.record(
        auth,
        {
          action: "creditNote.create",
          entity: "CreditNote",
          entityId: id,
          branchId,
          after: {
            number,
            invoice: inv.number,
            total: r2(totalPaise),
            refunded: r2(Math.max(over, 0)),
            reason: input.reason,
          },
        },
        tx,
      );
      return id;
    });
    return this.getById(auth, id);
  }

  async getById(auth: AuthContext, id: string): Promise<CreditNoteDto> {
    const note = await this.invoices.findCreditNote(id);
    if (!note || !canAccessBranch(auth, note.branchId)) throw notFound("Credit note not found");
    return note;
  }

  async list(
    auth: AuthContext,
    currentBranchId: string | undefined,
    query: ListCreditNotesQuery,
  ): Promise<Paginated<CreditNoteDto>> {
    let branchIds: string[];
    if (auth.isOwner && !currentBranchId) {
      branchIds = (await this.branches.list({ includeInactive: true })).map((b) => b.id);
    } else {
      if (!currentBranchId) throw badRequest("Choose a branch");
      if (!canAccessBranch(auth, currentBranchId)) throw forbidden("You don't have access to this branch");
      branchIds = [currentBranchId];
    }
    return this.invoices.listCreditNotes(branchIds, query);
  }
}
