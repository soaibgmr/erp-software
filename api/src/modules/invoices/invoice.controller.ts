import { inject, injectable } from "inversify";
import type { Request, Response } from "express";
import { z } from "zod";
import { TYPES } from "../../config/ioc.types";
import { sendCreated, sendPaginated, sendSuccess } from "../../common/api-response";
import { badRequest } from "../../common/http-error";
import type {
  ICartPricer,
  ICreditNoteService,
  IInvoicePostingService,
  IInvoiceService,
  IOpeningBalanceService,
  IPaymentService,
} from "./interfaces/iinvoice.service";
import { openingBalanceMessage } from "./opening-balance.service";
import { idempotencyKeySchema } from "./invoice.schema";

@injectable()
export class InvoiceController {
  constructor(
    @inject(TYPES.InvoiceService) private readonly invoices: IInvoiceService,
    @inject(TYPES.InvoicePostingService) private readonly posting: IInvoicePostingService,
    @inject(TYPES.PaymentService) private readonly payments: IPaymentService,
    @inject(TYPES.CreditNoteService) private readonly creditNotes: ICreditNoteService,
    @inject(TYPES.CartPricer) private readonly pricer: ICartPricer,
    @inject(TYPES.OpeningBalanceService) private readonly openingBalances: IOpeningBalanceService,
  ) {}

  // ---------- Invoices ----------

  list = async (_req: Request, res: Response) => {
    sendPaginated(res, await this.invoices.list(res.locals.auth, res.locals.branchId, res.locals.query));
  };

  getById = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.invoices.getById(res.locals.auth, res.locals.params.id));
  };

  print = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.invoices.print(res.locals.auth, res.locals.params.id));
  };

  // 201 for a new invoice; 200 when a retry with the same Idempotency-Key replays the first one.
  charge = async (req: Request, res: Response) => {
    const header = req.header("idempotency-key");
    let key: string | undefined;
    if (header !== undefined) {
      const parsed = idempotencyKeySchema.safeParse(header);
      if (!parsed.success) throw badRequest(z.prettifyError(parsed.error));
      key = parsed.data;
    }
    const { invoice, replayed } = await this.posting.charge(res.locals.auth, res.locals.branchId, res.locals.body, key);
    if (replayed) sendSuccess(res, invoice, { message: `Invoice ${invoice.number} was already saved` });
    else sendCreated(res, invoice, `Invoice ${invoice.number} saved`);
  };

  cancel = async (_req: Request, res: Response) => {
    const invoice = await this.invoices.cancel(res.locals.auth, res.locals.params.id, res.locals.body.reason);
    sendSuccess(res, invoice, { message: `Invoice ${invoice.number} cancelled` });
  };

  createOpeningBalance = async (_req: Request, res: Response) => {
    const invoice = await this.openingBalances.create(res.locals.auth, res.locals.branchId, res.locals.body);
    sendCreated(res, invoice, openingBalanceMessage(invoice));
  };

  customerCredit = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.pricer.customerCredit(res.locals.params.customerId));
  };

  // ---------- Payments ----------

  recordPayment = async (_req: Request, res: Response) => {
    const invoice = await this.payments.record(res.locals.auth, res.locals.params.id, res.locals.body);
    sendCreated(res, invoice, "Payment recorded");
  };

  reversePayment = async (_req: Request, res: Response) => {
    const invoice = await this.payments.reverse(res.locals.auth, res.locals.params.id, res.locals.body.reason);
    sendSuccess(res, invoice, { message: "Payment reversed" });
  };

  // ---------- Credit notes ----------

  listCreditNotes = async (_req: Request, res: Response) => {
    sendPaginated(res, await this.creditNotes.list(res.locals.auth, res.locals.branchId, res.locals.query));
  };

  getCreditNote = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.creditNotes.getById(res.locals.auth, res.locals.params.id));
  };

  createCreditNote = async (_req: Request, res: Response) => {
    const note = await this.creditNotes.create(res.locals.auth, res.locals.body);
    sendCreated(res, note, `Credit note ${note.number} created`);
  };
}
