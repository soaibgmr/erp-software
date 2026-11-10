import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { defaultSettings } from "@erp-software/shared";
import type { AuthContext } from "../../common/auth-context";
import type { IMailService } from "../mail/interfaces/imail.service";
import type { MailMessage } from "../mail/mail.types";
import type { ISettingsService } from "../settings/interfaces/isettings.service";
import type { IInvoiceService } from "./interfaces/iinvoice.service";
import { buildInvoicePdf, type InvoicePdfInput } from "./invoice-pdf";
import { InvoiceMailer } from "./invoice-mailer.service";

export const samplePdfInput = (lineCount: number): InvoicePdfInput => ({
  seller: {
    name: "Noor Auto Parts",
    legalName: "Noor Trading Company Pvt Ltd",
    address: "12/345 MG Road, Ernakulam, Kochi, 682011",
    gstin: "32ABCDE1234F1Z5",
    stateCode: "32",
    phone: "9847000000",
    email: "billing@noorauto.in",
    bankName: "State Bank of India",
    bankAccountNo: "1234567890",
    bankIfsc: "SBIN0001234",
    upiId: "noorauto@sbi",
  },
  invoice: {
    number: "INV-26-00007",
    date: new Date("2026-11-10T06:00:00Z"),
    dueDate: new Date("2026-11-25T18:29:59Z"),
    customerName: "Kerala Cabs & Travels",
    customerMobile: "9847012345",
    customerGstin: "32AAACK1234L1Z2",
    customerAddress: "Near KSRTC stand, Aluva",
    placeOfSupply: "32",
    supplyType: "INTRA_STATE",
    lines: Array.from({ length: lineCount }, (_, i) => ({
      description:
        i % 3 === 0
          ? `Oil filter – Maruti Swift VXi / Dzire (genuine part, long description to test wrapping) ₹ #${i + 1}`
          : `Brake pad set ${i + 1}`,
      hsnSac: "87089900",
      quantity: "2.000",
      unit: "PCS",
      rate: "500.00",
      discount: i % 2 ? "20.00" : "0.00",
      taxable: "1000.00",
      gstRate: 18,
      total: "1180.00",
    })),
    discountTotal: "40.00",
    taxableTotal: "1000.00",
    cgstTotal: "90.00",
    sgstTotal: "90.00",
    igstTotal: "0.00",
    roundOff: "0.00",
    grandTotal: "1180.00",
    paidTotal: "180.00",
    balanceDue: "1000.00",
  },
  taxSummary: [
    { gstRate: 18, hsnSac: "87089900", taxable: "1000.00", cgst: "90.00", sgst: "90.00", igst: "0.00" },
    { gstRate: 28, hsnSac: "40111010", taxable: "500.00", cgst: "70.00", sgst: "70.00", igst: "0.00" },
  ],
  amountInWords: "Rupees One Thousand One Hundred Eighty Only",
  terms: "Goods once sold will not be taken back.\nWarranty as per manufacturer terms only.",
  footerText: "Thank you for your business.",
  signatureLabel: null,
  timeZone: "Asia/Kolkata",
});

describe("Invoice PDF", () => {
  it("builds a one-page A4 PDF for a short bill", async () => {
    const bytes = await buildInvoicePdf(samplePdfInput(3));
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("continues long bills on more pages and copes with ₹, dashes and other characters", async () => {
    const bytes = await buildInvoicePdf(samplePdfInput(45));
    // Set INVOICE_PDF_SAMPLE=<path> to write the file and look at it.
    if (process.env.INVOICE_PDF_SAMPLE) writeFileSync(process.env.INVOICE_PDF_SAMPLE, bytes);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
  });
});

describe("InvoiceMailer", () => {
  it("emails the bill with the PDF attached, from the shop's name", async () => {
    const sample = samplePdfInput(2);
    const sent: MailMessage[] = [];
    const invoices = {
      print: async () => ({
        invoice: {
          ...sample.invoice,
          invoiceDate: sample.invoice.date,
          lines: sample.invoice.lines,
        },
        business: {
          legalName: "Noor Trading",
          tradeName: "Noor Auto Parts",
          stateCode: "32",
          email: "billing@noorauto.in",
        },
        branch: { gstin: null, stateCode: "32" },
        amountInWords: sample.amountInWords,
        taxSummary: sample.taxSummary,
      }),
    } as unknown as IInvoiceService;
    const settings = { get: async () => defaultSettings("print") } as unknown as ISettingsService;
    const mail: IMailService = {
      send: async (m) => void sent.push(m),
      sendQuietly: async (m) => void sent.push(m),
    };
    await new InvoiceMailer(invoices, settings, mail).send({} as AuthContext, "inv-1", "customer@example.com");

    expect(sent).toHaveLength(1);
    expect(sent[0]!.fromName).toBe("Noor Auto Parts");
    expect(sent[0]!.replyTo).toBe("billing@noorauto.in");
    const pdf = sent[0]!.attachments![0]!;
    expect(pdf.filename).toBe("INV-26-00007.pdf");
    expect(pdf.contentType).toBe("application/pdf");
    expect(
      Buffer.from(pdf.content as Buffer)
        .subarray(0, 5)
        .toString(),
    ).toBe("%PDF-");
  });
});
