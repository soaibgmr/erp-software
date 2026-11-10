import { inject, injectable } from "inversify";
import { formatINR, toPaise, type PaymentMethod } from "@automobile/shared";
import { TYPES } from "../../config/ioc.types";
import { canAccessBranch, type AuthContext } from "../../common/auth-context";
import { conflict, fieldErrors, notFound } from "../../common/http-error";
import type { IUnitOfWork } from "../../common/unit-of-work";
import type { IAuditService } from "../audit/interfaces/iaudit.service";
import type { IShiftService } from "../shifts/interfaces/ishift.service";
import type { IInvoiceRepository } from "./interfaces/iinvoice.repository";
import type { IInvoiceService, IPaymentService } from "./interfaces/iinvoice.service";
import { balanceDue, deriveStatus } from "./invoice.rules";
import type { CreatePaymentDto, InvoiceDetailDto } from "./invoice.types";

// Payments are append-only: receipts are positive rows; a mistake is undone by a negative REVERSAL row.
@injectable()
export class PaymentService implements IPaymentService {
  constructor(
    @inject(TYPES.UnitOfWork) private readonly uow: IUnitOfWork,
    @inject(TYPES.InvoiceRepository) private readonly invoices: IInvoiceRepository,
    @inject(TYPES.InvoiceService) private readonly invoiceService: IInvoiceService,
    @inject(TYPES.ShiftService) private readonly shifts: IShiftService,
    @inject(TYPES.AuditService) private readonly audit: IAuditService,
  ) {}

  async record(auth: AuthContext, invoiceId: string, input: CreatePaymentDto): Promise<InvoiceDetailDto> {
    const invoice = await this.invoiceService.getById(auth, invoiceId);
    const shiftId = await this.shifts.findOpenId(invoice.branch.id, auth.userId);

    await this.uow.run(async (tx) => {
      const inv = await this.invoices.lockInvoice(tx, invoiceId);
      if (!inv) throw notFound("Invoice not found");
      if (inv.status === "CANCELLED") throw conflict(`${inv.number} is cancelled`);
      const due = balanceDue(inv);
      const amount = toPaise(input.amount);
      if (due <= 0) throw conflict(`${inv.number} is already paid`);
      if (amount > due)
        throw fieldErrors([{ path: "amount", message: `Only ${formatINR(due / 100, { exact: true })} is due` }]);

      await this.invoices.createPayment(tx, {
        invoiceId,
        branchId: inv.branchId,
        shiftId,
        mode: input.mode,
        amount: (amount / 100).toFixed(2),
        reference: input.reference ?? null,
        note: input.note ?? null,
        createdById: auth.userId,
      });
      const paid = inv.paidTotal + amount;
      await this.invoices.updateTotals(tx, invoiceId, {
        paidPaise: paid,
        creditedPaise: inv.creditedTotal,
        status: deriveStatus(inv.grandTotal, inv.creditedTotal, paid),
      });
    });
    return this.invoiceService.getById(auth, invoiceId);
  }

  async reverse(auth: AuthContext, paymentId: string, reason: string): Promise<InvoiceDetailDto> {
    const payment = await this.invoices.findPayment(paymentId);
    if (!payment || !canAccessBranch(auth, payment.branchId)) throw notFound("Payment not found");
    if (payment.kind) throw conflict("Only a receipt can be reversed");
    if (payment.reversed) throw conflict("This payment is already reversed");
    const shiftId = await this.shifts.findOpenId(payment.branchId, auth.userId);

    await this.uow.run(async (tx) => {
      const inv = await this.invoices.lockInvoice(tx, payment.invoiceId);
      if (!inv) throw notFound("Invoice not found");
      if (inv.status === "CANCELLED") throw conflict(`${inv.number} is cancelled; its payments were already refunded`);

      // The unique reverses_payment_id makes a concurrent second reversal fail.
      await this.invoices.createPayment(tx, {
        invoiceId: inv.id,
        branchId: inv.branchId,
        shiftId,
        mode: payment.mode as PaymentMethod,
        amount: (-payment.amountPaise / 100).toFixed(2),
        kind: "REVERSAL",
        reversesPaymentId: payment.id,
        note: reason,
        createdById: auth.userId,
      });
      const paid = inv.paidTotal - payment.amountPaise;
      await this.invoices.updateTotals(tx, inv.id, {
        paidPaise: paid,
        creditedPaise: inv.creditedTotal,
        status: deriveStatus(inv.grandTotal, inv.creditedTotal, paid),
      });
      await this.audit.record(
        auth,
        {
          action: "payment.reverse",
          entity: "Payment",
          entityId: payment.id,
          branchId: inv.branchId,
          before: { invoice: inv.number, mode: payment.mode, amount: (payment.amountPaise / 100).toFixed(2) },
          after: { reason },
        },
        tx,
      );
    });
    return this.invoiceService.getById(auth, payment.invoiceId);
  }
}
