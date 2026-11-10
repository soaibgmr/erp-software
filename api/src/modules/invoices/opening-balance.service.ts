import { inject, injectable } from "inversify";
import { formatINR, toPaise } from "@automobile/shared";
import { TYPES } from "../../config/ioc.types";
import { env } from "../../config/env";
import { canAccessBranch, type AuthContext } from "../../common/auth-context";
import { fieldErrors, forbidden, notFound } from "../../common/http-error";
import type { IUnitOfWork } from "../../common/unit-of-work";
import { endOfDayAfter, startOfDayIn } from "../../utils/time";
import type { IAuditService } from "../audit/interfaces/iaudit.service";
import type { IBranchRepository } from "../branches/interfaces/ibranch.repository";
import type { ICustomerRepository } from "../customers/interfaces/icustomer.repository";
import type { IDocumentSequenceService } from "../document-sequences/interfaces/idocument-sequence.service";
import { todayIn } from "../../common/date-only";
import type { IInvoiceRepository } from "./interfaces/iinvoice.repository";
import type { IInvoiceService, IOpeningBalanceService } from "./interfaces/iinvoice.service";
import type { CreateOpeningBalanceDto, InvoiceDetailDto } from "./invoice.types";

const ZERO = "0.00";

// A customer's old dues, entered once at go-live. Saved as an invoice of kind OPENING_BALANCE with
// no lines, no tax and no stock movement, so dues, collection, ageing and overdue all work as for a
// sale, while sales, GST and Tally sales skip it.
@injectable()
export class OpeningBalanceService implements IOpeningBalanceService {
  constructor(
    @inject(TYPES.UnitOfWork) private readonly uow: IUnitOfWork,
    @inject(TYPES.InvoiceRepository) private readonly invoices: IInvoiceRepository,
    @inject(TYPES.InvoiceService) private readonly invoiceService: IInvoiceService,
    @inject(TYPES.CustomerRepository) private readonly customers: ICustomerRepository,
    @inject(TYPES.BranchRepository) private readonly branches: IBranchRepository,
    @inject(TYPES.DocumentSequenceService) private readonly sequences: IDocumentSequenceService,
    @inject(TYPES.AuditService) private readonly audit: IAuditService,
  ) {}

  async create(auth: AuthContext, branchId: string, input: CreateOpeningBalanceDto): Promise<InvoiceDetailDto> {
    if (!canAccessBranch(auth, branchId)) throw forbidden("You don't have access to this branch");
    const tz = env.APP_TIMEZONE;
    if (input.asOfDate > todayIn(tz)) throw fieldErrors([{ path: "asOfDate", message: "Can't be a future date" }]);

    const [customer, branch] = await Promise.all([
      this.customers.findById(input.customerId),
      this.branches.findById(branchId),
    ]);
    if (!customer) throw fieldErrors([{ path: "customerId", message: "Customer not found" }]);
    if (!branch) throw notFound("Branch not found");

    const amount = (toPaise(input.amount) / 100).toFixed(2);
    const invoiceDate = startOfDayIn(input.asOfDate, tz);
    // Due like a sale made that day: after the customer's days to clear dues.
    const dueDate = endOfDayAfter(invoiceDate, customer.creditDays, tz);
    const placeOfSupply = customer.stateCode ?? branch.stateCode;

    const id = await this.uow.run(async (tx) => {
      const { number } = await this.sequences.next(tx, branchId, "OPENING_BALANCE");
      const { id: created } = await this.invoices.create(tx, {
        number,
        kind: "OPENING_BALANCE",
        branchId,
        shiftId: null,
        customerId: customer.id,
        customerName: customer.name,
        customerMobile: customer.mobile,
        customerGstin: customer.gstin,
        customerAddress: customer.address,
        placeOfSupply,
        supplyType: placeOfSupply === branch.stateCode ? "INTRA_STATE" : "INTER_STATE",
        invoiceDate,
        dueDate,
        status: "UNPAID",
        grossTotal: amount,
        discountTotal: ZERO,
        billDiscountType: null,
        billDiscountValue: null,
        taxableTotal: ZERO,
        cgstTotal: ZERO,
        sgstTotal: ZERO,
        igstTotal: ZERO,
        roundOff: ZERO,
        grandTotal: amount,
        paidTotal: ZERO,
        notes: input.note ?? null,
        discountApprovedById: null,
        creditApprovedById: null,
        createdById: auth.userId,
        lines: [],
      });
      await this.audit.record(
        auth,
        {
          action: "customer.opening_balance",
          entity: "Invoice",
          entityId: created,
          branchId,
          after: { number, customer: customer.name, amount, asOfDate: input.asOfDate, note: input.note ?? null },
        },
        tx,
      );
      return created;
    });
    return this.invoiceService.getById(auth, id);
  }
}

export const openingBalanceMessage = (inv: InvoiceDetailDto) =>
  `Old dues of ${formatINR(inv.grandTotal, { exact: true })} added for ${inv.customerName ?? "the customer"} (${inv.number})`;
