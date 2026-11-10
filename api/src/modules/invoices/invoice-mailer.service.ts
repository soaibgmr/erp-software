import { inject, injectable } from "inversify";
import { waitUntil } from "@vercel/functions";
import { TYPES } from "../../config/ioc.types";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import type { AuthContext } from "../../common/auth-context";
import type { IMailService } from "../mail/interfaces/imail.service";
import { invoiceMail } from "../mail/mail.templates";
import type { ISettingsService } from "../settings/interfaces/isettings.service";
import type { IInvoiceMailer, IInvoiceService } from "./interfaces/iinvoice.service";
import { buildInvoicePdf } from "./invoice-pdf";

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

// Emails a bill to the customer: the bill in the email body plus the tax invoice as a PDF attachment.
// Charging calls emailInBackground so the counter never waits on SMTP.
@injectable()
export class InvoiceMailer implements IInvoiceMailer {
  constructor(
    @inject(TYPES.InvoiceService) private readonly invoices: IInvoiceService,
    @inject(TYPES.SettingsService) private readonly settings: ISettingsService,
    @inject(TYPES.MailService) private readonly mail: IMailService,
  ) {}

  async send(auth: AuthContext, invoiceId: string, to: string): Promise<void> {
    const [{ invoice, business, branch, amountInWords, taxSummary }, print] = await Promise.all([
      this.invoices.print(auth, invoiceId),
      this.settings.get(auth.businessId, "print"),
    ]);
    const name = text(business.tradeName) ?? text(business.legalName) ?? "Your shop";
    // A branch registered separately prints its own GSTIN, address and phone (same rule as the printed bill).
    const branchGstin = text(branch.gstin);
    const address =
      [
        text(branch.address) ?? text(business.address),
        text(branch.city) ?? text(business.city),
        text(branch.pincode) ?? text(business.pincode),
      ]
        .filter(Boolean)
        .join(", ") || null;
    const seller = {
      name,
      gstin: branchGstin ?? text(business.gstin),
      address,
      phone: text(branch.phone) ?? text(business.phone),
      email: text(business.email),
    };
    const bill = {
      number: invoice.number,
      date: new Date(invoice.invoiceDate),
      dueDate: invoice.dueDate ? new Date(invoice.dueDate) : null,
      customerName: invoice.customerName,
      customerGstin: invoice.customerGstin,
      lines: invoice.lines,
      discountTotal: invoice.discountTotal,
      taxableTotal: invoice.taxableTotal,
      cgstTotal: invoice.cgstTotal,
      sgstTotal: invoice.sgstTotal,
      igstTotal: invoice.igstTotal,
      roundOff: invoice.roundOff,
      grandTotal: invoice.grandTotal,
      paidTotal: invoice.paidTotal,
      balanceDue: invoice.balanceDue,
      amountInWords,
    };

    const pdf = await buildInvoicePdf({
      seller: {
        ...seller,
        legalName: text(business.legalName),
        stateCode: text(branch.stateCode) ?? text(business.stateCode),
        bankName: text(business.bankName),
        bankAccountNo: text(business.bankAccountNo),
        bankIfsc: text(business.bankIfsc),
        upiId: text(business.upiId),
      },
      invoice: {
        ...bill,
        customerMobile: invoice.customerMobile,
        customerAddress: invoice.customerAddress,
        placeOfSupply: invoice.placeOfSupply,
        supplyType: invoice.supplyType,
      },
      taxSummary,
      amountInWords,
      terms: print.invoiceTerms ?? null,
      footerText: print.footerText ?? null,
      signatureLabel: print.signatureLabel ?? null,
      timeZone: env.APP_TIMEZONE,
    });

    const content = invoiceMail({ business: seller, invoice: bill });
    await this.mail.send({
      to,
      ...content,
      fromName: name,
      replyTo: seller.email ?? undefined,
      attachments: [{ filename: `${invoice.number}.pdf`, content: Buffer.from(pdf), contentType: "application/pdf" }],
    });
  }

  emailInBackground(auth: AuthContext, invoiceId: string, to: string): void {
    // waitUntil keeps a serverless function (Vercel) alive until the email is out; locally it just runs it.
    waitUntil(
      this.send(auth, invoiceId, to).catch((err: unknown) => logger.error({ err, invoiceId, to }, "Bill email failed")),
    );
  }
}
