import { createHash } from "node:crypto";
import { inject, injectable } from "inversify";
import bcrypt from "bcryptjs";
import {
  formatINR,
  milliToDecimal,
  paymentSummary,
  toMilli,
  type ManagerOverride,
  type Permission,
} from "@erp-software/shared";
import { TYPES } from "../../config/ioc.types";
import { env } from "../../config/env";
import { endOfDayAfter } from "../../utils/time";
import { hasPermission, type AuthContext } from "../../common/auth-context";
import { badRequest, conflict, fieldErrors, HttpError } from "../../common/http-error";
import { isUniqueViolation } from "../../common/prisma-types";
import type { IUnitOfWork } from "../../common/unit-of-work";
import type { IAuditService } from "../audit/interfaces/iaudit.service";
import type { IDocumentSequenceService } from "../document-sequences/interfaces/idocument-sequence.service";
import type { IHeldCartRepository } from "../pos/interfaces/iheld-cart.repository";
import type { ISettingsService } from "../settings/interfaces/isettings.service";
import type { IShiftService } from "../shifts/interfaces/ishift.service";
import type { IStockService } from "../stock/interfaces/istock.service";
import type { IUserRepository } from "../users/interfaces/iuser.repository";
import type { IInvoiceRepository } from "./interfaces/iinvoice.repository";
import type {
  ICartPricer,
  IInvoiceMailer,
  IInvoicePostingService,
  IInvoiceService,
} from "./interfaces/iinvoice.service";
import { deriveStatus } from "./invoice.rules";
import type { CreateInvoiceDto, InvoiceDetailDto } from "./invoice.types";

const SCOPE = "invoice.charge";
const rupees = (paise: number) => (paise / 100).toFixed(2);

// 403 the POS answers with a manager-override dialog; details.approvals lists what needs approving.
export const approvalRequired = (message: string, approvals: ("discount" | "credit")[]) =>
  new HttpError(403, "APPROVAL_REQUIRED", message, { approvals });

// POS charge (Unit of Work): number → invoice + lines → stock → payments → outbox, in one transaction.
@injectable()
export class InvoicePostingService implements IInvoicePostingService {
  constructor(
    @inject(TYPES.UnitOfWork) private readonly uow: IUnitOfWork,
    @inject(TYPES.CartPricer) private readonly pricer: ICartPricer,
    @inject(TYPES.InvoiceRepository) private readonly invoices: IInvoiceRepository,
    @inject(TYPES.InvoiceService) private readonly invoiceService: IInvoiceService,
    @inject(TYPES.StockService) private readonly stock: IStockService,
    @inject(TYPES.ShiftService) private readonly shifts: IShiftService,
    @inject(TYPES.DocumentSequenceService) private readonly sequences: IDocumentSequenceService,
    @inject(TYPES.HeldCartRepository) private readonly heldCarts: IHeldCartRepository,
    @inject(TYPES.UserRepository) private readonly users: IUserRepository,
    @inject(TYPES.SettingsService) private readonly settings: ISettingsService,
    @inject(TYPES.AuditService) private readonly audit: IAuditService,
    @inject(TYPES.InvoiceMailer) private readonly mailer: IInvoiceMailer,
  ) {}

  async charge(auth: AuthContext, branchId: string, input: CreateInvoiceDto, idempotencyKey?: string) {
    // The manager's password never takes part in the request fingerprint.
    const { override, ...fingerprinted } = input;
    const requestHash = createHash("sha256")
      .update(JSON.stringify({ branchId, ...fingerprinted }))
      .digest("hex");

    if (idempotencyKey) {
      const replay = await this.replay(auth, idempotencyKey, requestHash);
      if (replay) return replay;
    }

    const shiftId = await this.shifts.findOpenId(branchId, auth.userId);
    if (!shiftId) throw conflict("Open a shift before billing");

    const priced = await this.pricer.price(auth, branchId, input);
    if (priced.quote.issues.length) {
      throw fieldErrors(
        priced.quote.issues.map((i) => ({
          path: i.line === undefined ? "billDiscount" : `lines.${i.line}.discount`,
          message: i.message,
        })),
      );
    }
    const totalPaise = priced.totals.totalPaise;
    if (input.expectedTotal !== undefined && Math.round(input.expectedTotal * 100) !== totalPaise) {
      throw conflict(
        `Prices changed: the total is now ${formatINR(totalPaise / 100, { exact: true })}. Check the cart and charge again.`,
      );
    }

    // Money in: payments may not exceed the total; anything unpaid is a credit sale.
    const { paidPaise } = paymentSummary(totalPaise, input.payments);
    if (paidPaise > totalPaise) throw fieldErrors([{ path: "payments", message: "Payments are more than the total" }]);
    const unpaidPaise = totalPaise - paidPaise;
    // Every bill belongs to a customer (found by mobile or email at the counter): no walk-in bills.
    const customer = priced.customer;
    if (!customer) {
      throw fieldErrors([
        { path: "customerId", message: "Enter the customer's mobile number or email before billing" },
      ]);
    }

    // Approvals: discount above the role limit, credit above the customer's limit.
    const approvals: ("discount" | "credit")[] = [];
    if (priced.quote.needsDiscountApproval) approvals.push("discount");
    const creditExceeded =
      customer &&
      unpaidPaise > 0 &&
      Math.round(Number(customer.outstanding) * 100) + unpaidPaise > Math.round(Number(customer.creditLimit) * 100);
    if (creditExceeded && !hasPermission(auth, "credit.override")) approvals.push("credit");
    const approverId = approvals.length ? await this.verifyOverride(auth, branchId, override, approvals) : null;

    const { allowNegativeStock } = await this.settings.get(auth.businessId, "pos");
    const dueDate = unpaidPaise > 0 ? endOfDayAfter(new Date(), customer?.creditDays ?? 0, env.APP_TIMEZONE) : null;

    let invoiceId: string;
    try {
      invoiceId = await this.uow.run(async (tx) => {
        const { number } = await this.sequences.next(tx, branchId, "INVOICE");
        const { id } = await this.invoices.create(tx, {
          number,
          branchId,
          shiftId,
          customerId: customer?.id ?? null,
          customerName: customer?.name ?? null,
          customerMobile: customer?.mobile ?? null,
          customerGstin: customer?.gstin ?? null,
          customerAddress: customer?.address ?? null,
          placeOfSupply: priced.placeOfSupply,
          supplyType: priced.supplyType,
          dueDate,
          status: deriveStatus(totalPaise, 0, paidPaise),
          grossTotal: rupees(priced.totals.grossPaise),
          discountTotal: rupees(priced.totals.discountPaise),
          billDiscountType: input.billDiscount?.value ? input.billDiscount.type : null,
          billDiscountValue: input.billDiscount?.value ? input.billDiscount.value.toFixed(2) : null,
          taxableTotal: rupees(priced.totals.taxablePaise),
          cgstTotal: rupees(priced.totals.cgstPaise),
          sgstTotal: rupees(priced.totals.sgstPaise),
          igstTotal: rupees(priced.totals.igstPaise),
          roundOff: rupees(priced.totals.roundOffPaise),
          grandTotal: rupees(totalPaise),
          paidTotal: rupees(paidPaise),
          notes: input.notes ?? null,
          discountApprovedById: approvals.includes("discount") ? approverId : null,
          creditApprovedById: approvals.includes("credit") ? approverId : null,
          createdById: auth.userId,
          lines: priced.lines.map((l, i) => ({
            lineNo: i + 1,
            kind: l.kind,
            itemId: l.itemId,
            labourServiceId: l.labourServiceId,
            description: l.description,
            sku: l.sku,
            hsnSac: l.hsnSac,
            unit: l.unit,
            quantity: milliToDecimal(toMilli(l.quantity)),
            rate: l.rate.toFixed(2),
            taxInclusive: l.taxInclusive,
            gstRate: l.gstRate.toFixed(2),
            lineDiscount: rupees(l.lineDiscountPaise),
            billDiscount: rupees(l.billDiscountPaise),
            taxable: rupees(l.taxablePaise),
            cgst: rupees(l.cgstPaise),
            sgst: rupees(l.sgstPaise),
            igst: rupees(l.igstPaise),
            total: rupees(l.totalPaise),
            unitCost: l.unitCost == null ? null : l.unitCost.toFixed(2),
          })),
        });

        await this.stock.post(
          tx,
          auth,
          priced.lines
            .filter((l) => l.kind === "ITEM")
            .map((l) => ({
              branchId,
              itemId: l.itemId!,
              type: "SALE" as const,
              quantity: -l.quantity,
              unitCost: l.unitCost,
              refType: "Invoice",
              refId: id,
              refNo: number,
            })),
          { allowNegative: allowNegativeStock },
        );

        for (const p of input.payments) {
          await this.invoices.createPayment(tx, {
            invoiceId: id,
            branchId,
            shiftId,
            mode: p.mode,
            amount: p.amount.toFixed(2),
            tendered: p.tendered == null ? null : p.tendered.toFixed(2),
            reference: p.reference ?? null,
            createdById: auth.userId,
          });
        }

        await this.invoices.addOutboxEvent(tx, auth.businessId, "InvoicePosted", { invoiceId: id, number, branchId });
        if (input.heldCartId) await this.heldCarts.softDelete(input.heldCartId, tx);
        if (idempotencyKey) {
          await this.invoices.saveIdempotency(tx, {
            userId: auth.userId,
            key: idempotencyKey,
            scope: SCOPE,
            requestHash,
            resourceId: id,
          });
        }
        if (approverId) {
          await this.audit.record(
            auth,
            {
              action: "invoice.override",
              entity: "Invoice",
              entityId: id,
              branchId,
              after: {
                number,
                approvals,
                approvedById: approverId,
                discount: priced.quote.discount,
                discountPercent: priced.quote.discountPercent,
                unpaid: rupees(unpaidPaise),
                creditLimit: customer?.creditLimit ?? null,
              },
            },
            tx,
          );
        }
        return id;
      });
    } catch (err) {
      // Lost a race with an identical retry: answer with the invoice that won.
      if (idempotencyKey && isUniqueViolation(err)) {
        const replay = await this.replay(auth, idempotencyKey, requestHash);
        if (replay) return replay;
      }
      throw err;
    }

    // The customer gets the bill by email when we have their address. Never delays the counter.
    if (customer?.email) this.mailer.emailInBackground(auth, invoiceId, customer.email);

    return { invoice: await this.invoiceService.getById(auth, invoiceId), replayed: false };
  }

  private async replay(
    auth: AuthContext,
    key: string,
    requestHash: string,
  ): Promise<{ invoice: InvoiceDetailDto; replayed: true } | null> {
    const stored = await this.invoices.findIdempotency(auth.userId, key);
    if (!stored) return null;
    if (stored.scope !== SCOPE || stored.requestHash !== requestHash) {
      throw conflict("This Idempotency-Key was already used for a different request");
    }
    return { invoice: await this.invoiceService.getById(auth, stored.resourceId), replayed: true };
  }

  // A manager signs in at the counter to approve. Their account must hold the permissions and the branch.
  private async verifyOverride(
    auth: AuthContext,
    branchId: string,
    override: ManagerOverride | undefined,
    approvals: ("discount" | "credit")[],
  ): Promise<string> {
    const needed: Permission[] = approvals.map((a) => (a === "discount" ? "discount.override" : "credit.override"));
    const what = approvals
      .map((a) => (a === "discount" ? "the discount" : "dues above the customer's limit"))
      .join(" and ");
    if (!override) throw approvalRequired(`A manager must approve ${what}`, approvals);

    const creds = await this.users.findCredentialsByIdentifier(override.identifier);
    const valid =
      creds &&
      creds.status === "ACTIVE" &&
      // Only a manager of this shop can approve.
      creds.businessId === auth.businessId &&
      (await bcrypt.compare(override.password, creds.passwordHash));
    if (!valid) throw approvalRequired("Manager mobile number or password is wrong", approvals);

    const manager = await this.users.findAuthUser(creds.id);
    const isOwner = manager?.role.key === "OWNER";
    const allowed =
      manager &&
      (isOwner || (needed.every((p) => manager.role.permissions.includes(p)) && manager.branchIds.includes(branchId)));
    if (!allowed) throw approvalRequired(`That account can't approve ${what} in this branch`, approvals);
    if (creds.id === auth.userId) throw badRequest("Ask another manager to approve");
    return creds.id;
  }
}
