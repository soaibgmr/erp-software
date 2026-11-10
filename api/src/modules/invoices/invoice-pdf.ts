import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { formatQty, stateName } from "@erp-software/shared";

// A4 tax invoice as a PDF, attached to the bill email. Pure function: data in, bytes out.
// Uses the built-in Helvetica fonts (no font files to ship), so text is limited to the Windows-1252
// character set: "₹" is written as "Rs." and anything else outside it becomes "?".

export interface InvoicePdfInput {
  seller: {
    name: string;
    legalName: string | null;
    address: string | null;
    gstin: string | null;
    stateCode: string | null;
    phone: string | null;
    email: string | null;
    bankName: string | null;
    bankAccountNo: string | null;
    bankIfsc: string | null;
    upiId: string | null;
  };
  invoice: {
    number: string;
    date: Date;
    dueDate: Date | null;
    customerName: string | null;
    customerMobile: string | null;
    customerGstin: string | null;
    customerAddress: string | null;
    placeOfSupply: string;
    supplyType: "INTRA_STATE" | "INTER_STATE";
    lines: {
      description: string;
      hsnSac: string | null;
      quantity: string;
      unit: string;
      rate: string;
      discount: string;
      taxable: string;
      gstRate: number;
      total: string;
    }[];
    discountTotal: string;
    taxableTotal: string;
    cgstTotal: string;
    sgstTotal: string;
    igstTotal: string;
    roundOff: string;
    grandTotal: string;
    paidTotal: string;
    balanceDue: string;
  };
  taxSummary: { gstRate: number; hsnSac: string | null; taxable: string; cgst: string; sgst: string; igst: string }[];
  amountInWords: string;
  terms: string | null;
  footerText: string | null;
  signatureLabel: string | null;
  timeZone: string;
}

const A4: [number, number] = [595.28, 841.89];
const M = 40; // page margin
const W = A4[0] - M * 2;
const INK = rgb(0.12, 0.16, 0.2);
const SLATE = rgb(0.32, 0.38, 0.43);
const LINE = rgb(0.85, 0.87, 0.9);
const NAVY = rgb(0.12, 0.23, 0.37);
const SHADE = rgb(0.95, 0.96, 0.98);

// Characters Helvetica (WinAnsi) can draw beyond Latin-1.
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
function safe(text: string): string {
  return text
    .replace(/₹\s?/g, "Rs. ")
    .replace(/[−]/g, "-")
    .replace(/[\t\r]/g, " ")
    .split("")
    .map((c) =>
      c === "\n" || (c >= " " && c <= "ÿ" && !(c >= "\u007f" && c < " ")) || WIN_ANSI_EXTRA.has(c) ? c : "?",
    )
    .join("");
}

const inr = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (v: string | number) => inr.format(Number(v));
const rs = (v: string | number) => `Rs. ${money(v)}`;

class Writer {
  page!: PDFPage;
  y = 0;
  pageNo = 0;

  constructor(
    readonly doc: PDFDocument,
    readonly font: PDFFont,
    readonly bold: PDFFont,
    readonly footer: string,
  ) {}

  newPage() {
    this.page = this.doc.addPage(A4);
    this.pageNo += 1;
    this.y = A4[1] - M;
    this.page.drawText(safe(this.footer), { x: M, y: M - 22, size: 7.5, font: this.font, color: SLATE });
  }

  // Starts a new page when fewer than `h` points are left above the bottom margin.
  ensure(h: number, onNewPage?: () => void) {
    if (this.y - h < M + 10) {
      this.newPage();
      onNewPage?.();
    }
  }

  text(t: string, x: number, size = 9, opts: { bold?: boolean; color?: ReturnType<typeof rgb>; right?: number } = {}) {
    const font = opts.bold ? this.bold : this.font;
    const s = safe(t);
    const at = opts.right !== undefined ? opts.right - font.widthOfTextAtSize(s, size) : x;
    this.page.drawText(s, { x: at, y: this.y, size, font, color: opts.color ?? INK });
  }

  wrap(t: string, width: number, size = 9, bold = false): string[] {
    const font = bold ? this.bold : this.font;
    const out: string[] = [];
    for (const para of safe(t).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) <= width) {
          line = next;
          continue;
        }
        if (line) out.push(line);
        // A single word wider than the column is cut into pieces.
        let rest = word;
        while (font.widthOfTextAtSize(rest, size) > width) {
          let n = rest.length - 1;
          while (n > 1 && font.widthOfTextAtSize(rest.slice(0, n), size) > width) n--;
          out.push(rest.slice(0, n));
          rest = rest.slice(n);
        }
        line = rest;
      }
      out.push(line);
    }
    return out;
  }

  rule(y = this.y, color = LINE, thickness = 0.6) {
    this.page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness, color });
  }
}

export async function buildInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const { seller, invoice } = input;
  const doc = await PDFDocument.create();
  doc.setTitle(`Tax invoice ${invoice.number}`);
  doc.setAuthor(seller.name);
  doc.setCreator("ERP Software");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new Writer(doc, font, bold, `${invoice.number} · This is a computer-generated invoice.`);
  const date = (d: Date) =>
    new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: input.timeZone,
    }).format(d);
  w.newPage();

  // ---- Header: seller on the left, title and number on the right ----
  const headerTop = w.y;
  w.text(seller.name, M, 15, { bold: true });
  w.y -= 14;
  const sellerLines = [
    seller.legalName && seller.legalName !== seller.name ? seller.legalName : null,
    seller.address,
    [seller.phone && `Phone ${seller.phone}`, seller.email].filter(Boolean).join("  |  ") || null,
    seller.gstin ? `GSTIN ${seller.gstin}` : null,
    seller.stateCode ? `State ${seller.stateCode} - ${stateName(seller.stateCode) ?? ""}` : null,
  ].filter((l): l is string => Boolean(l));
  for (const l of sellerLines.flatMap((l) => w.wrap(l, W * 0.58, 8.5))) {
    w.text(l, M, 8.5, { color: SLATE });
    w.y -= 11;
  }
  const leftBottom = w.y;
  w.y = headerTop;
  w.text("TAX INVOICE", 0, 13, { bold: true, color: NAVY, right: M + W });
  w.y -= 18;
  for (const [label, value] of [
    ["Invoice no.", invoice.number],
    ["Date", date(invoice.date)],
    ...(invoice.dueDate && Number(invoice.balanceDue) > 0 ? [["Due date", date(invoice.dueDate)]] : []),
  ] as [string, string][]) {
    w.text(label, 0, 8.5, { color: SLATE, right: M + W - 90 });
    w.text(value, 0, 9, { bold: true, right: M + W });
    w.y -= 12;
  }
  w.y = Math.min(leftBottom, w.y) - 6;
  w.rule(w.y, NAVY, 1.2);
  w.y -= 16;

  // ---- Bill to / place of supply ----
  const blockTop = w.y;
  w.text("BILL TO", M, 7.5, { bold: true, color: SLATE });
  w.y -= 12;
  w.text(invoice.customerName ?? "Walk-in customer", M, 10, { bold: true });
  w.y -= 12;
  for (const l of [
    invoice.customerAddress,
    invoice.customerMobile && `Mobile ${invoice.customerMobile}`,
    invoice.customerGstin && `GSTIN ${invoice.customerGstin}`,
  ]
    .filter((l): l is string => Boolean(l))
    .flatMap((l) => w.wrap(l, W * 0.55, 8.5))) {
    w.text(l, M, 8.5, { color: SLATE });
    w.y -= 11;
  }
  const billBottom = w.y;
  w.y = blockTop;
  w.text("PLACE OF SUPPLY", 0, 7.5, { bold: true, color: SLATE, right: M + W });
  w.y -= 12;
  w.text(`${invoice.placeOfSupply} - ${stateName(invoice.placeOfSupply) ?? ""}`, 0, 9.5, { right: M + W });
  w.y -= 12;
  w.text(invoice.supplyType === "INTER_STATE" ? "Inter-state (IGST)" : "Within state (CGST + SGST)", 0, 8.5, {
    color: SLATE,
    right: M + W,
  });
  w.y = Math.min(billBottom, w.y - 12) - 8;

  // ---- Items table ----
  // Columns: #, item, HSN, qty, rate, discount, taxable, GST %, amount (widths add up to W).
  const cols = [
    { key: "#", w: 18, right: false },
    { key: "Item", w: 157, right: false },
    { key: "HSN/SAC", w: 48, right: false },
    { key: "Qty", w: 48, right: true },
    { key: "Rate", w: 52, right: true },
    { key: "Disc.", w: 42, right: true },
    { key: "Taxable", w: 58, right: true },
    { key: "GST", w: 30, right: true },
    { key: "Amount", w: 62, right: true },
  ];
  const xs: number[] = [];
  cols.reduce((x, c) => (xs.push(x), x + c.w), M);
  const cellX = (i: number) => (cols[i]!.right ? xs[i]! + cols[i]!.w - 4 : xs[i]! + 4);

  const tableHeader = () => {
    w.page.drawRectangle({ x: M, y: w.y - 6, width: W, height: 18, color: SHADE });
    cols.forEach((c, i) =>
      w.text(c.key, cellX(i), 7.5, { bold: true, color: SLATE, ...(c.right ? { right: cellX(i) } : {}) }),
    );
    w.y -= 20;
  };
  w.ensure(60);
  tableHeader();

  invoice.lines.forEach((l, idx) => {
    const desc = w.wrap(l.description, cols[1]!.w - 8, 8.5);
    const h = Math.max(desc.length * 10.5, 10.5) + 6;
    w.ensure(h, tableHeader);
    const values = [
      String(idx + 1),
      "",
      l.hsnSac ?? "",
      `${formatQty(l.quantity)} ${l.unit}`,
      money(l.rate),
      Number(l.discount) ? money(l.discount) : "-",
      money(l.taxable),
      `${l.gstRate}%`,
      money(l.total),
    ];
    values.forEach((v, i) => {
      if (i === 1) return;
      w.text(v, cellX(i), 8.5, cols[i]!.right ? { right: cellX(i) } : {});
    });
    const top = w.y;
    desc.forEach((d, j) => {
      w.y = top - j * 10.5;
      w.text(d, cellX(1), 8.5);
    });
    w.y = top - (h - 6) - 2;
    w.rule(w.y + 4);
    w.y -= 8;
  });

  // ---- Totals (right) and amount in words (left) ----
  const totals: [string, string, boolean][] = [
    ...(Number(invoice.discountTotal)
      ? [["Discount", `- ${rs(invoice.discountTotal)}`, false] as [string, string, boolean]]
      : []),
    ["Taxable value", rs(invoice.taxableTotal), false],
    ...(invoice.supplyType === "INTER_STATE"
      ? [["IGST", rs(invoice.igstTotal), false] as [string, string, boolean]]
      : [
          ["CGST", rs(invoice.cgstTotal), false] as [string, string, boolean],
          ["SGST", rs(invoice.sgstTotal), false] as [string, string, boolean],
        ]),
    ...(Number(invoice.roundOff) ? [["Round off", rs(invoice.roundOff), false] as [string, string, boolean]] : []),
    ["Total", rs(invoice.grandTotal), true],
    ["Paid", rs(invoice.paidTotal), false],
    ...(Number(invoice.balanceDue) > 0
      ? [["Balance due", rs(invoice.balanceDue), true] as [string, string, boolean]]
      : []),
  ];
  w.ensure(totals.length * 14 + 30);
  const totalsTop = w.y;
  for (const [label, value, strong] of totals) {
    if (label === "Total") {
      w.page.drawRectangle({ x: M + W - 210, y: w.y - 5, width: 210, height: 17, color: SHADE });
    }
    w.text(label, 0, strong ? 9.5 : 9, { bold: strong, color: strong ? INK : SLATE, right: M + W - 110 });
    w.text(value, 0, strong ? 9.5 : 9, { bold: strong, right: M + W - 4 });
    w.y -= 14;
  }
  const totalsBottom = w.y;
  w.y = totalsTop;
  w.text("Amount in words", M, 7.5, { bold: true, color: SLATE });
  w.y -= 12;
  for (const l of w.wrap(input.amountInWords, W - 230, 9)) {
    w.text(l, M, 9);
    w.y -= 11;
  }
  w.y = Math.min(w.y, totalsBottom) - 10;

  // ---- HSN / SAC tax summary ----
  if (input.taxSummary.length) {
    const inter = invoice.supplyType === "INTER_STATE";
    const sc = inter
      ? [
          ["HSN/SAC", 110, false],
          ["GST rate", 80, true],
          ["Taxable", 110, true],
          ["IGST", 110, true],
          ["Total tax", 105, true],
        ]
      : [
          ["HSN/SAC", 95, false],
          ["GST rate", 70, true],
          ["Taxable", 95, true],
          ["CGST", 80, true],
          ["SGST", 80, true],
          ["Total tax", 95, true],
        ];
    const sx: number[] = [];
    sc.reduce((x, c) => (sx.push(x), x + (c[1] as number)), M);
    const at = (i: number) => (sc[i]![2] ? sx[i]! + (sc[i]![1] as number) - 4 : sx[i]! + 4);
    const header = () => {
      w.page.drawRectangle({ x: M, y: w.y - 6, width: W, height: 18, color: SHADE });
      sc.forEach((c, i) =>
        w.text(c[0] as string, at(i), 7.5, { bold: true, color: SLATE, ...(c[2] ? { right: at(i) } : {}) }),
      );
      w.y -= 18;
    };
    w.ensure(40 + input.taxSummary.length * 13);
    w.text("Tax summary", M, 8.5, { bold: true });
    w.y -= 14;
    header();
    for (const t of input.taxSummary) {
      w.ensure(14, header);
      const tax = Number(t.cgst) + Number(t.sgst) + Number(t.igst);
      const row = inter
        ? [t.hsnSac ?? "-", `${t.gstRate}%`, money(t.taxable), money(t.igst), money(tax)]
        : [t.hsnSac ?? "-", `${t.gstRate}%`, money(t.taxable), money(t.cgst), money(t.sgst), money(tax)];
      row.forEach((v, i) => w.text(v, at(i), 8.5, sc[i]![2] ? { right: at(i) } : {}));
      w.y -= 13;
    }
    w.rule(w.y + 6);
    w.y -= 12;
  }

  // ---- Bank / UPI, terms, signature ----
  const bank = [
    seller.bankName && `Bank: ${seller.bankName}`,
    seller.bankAccountNo && `A/c no.: ${seller.bankAccountNo}`,
    seller.bankIfsc && `IFSC: ${seller.bankIfsc}`,
    seller.upiId && `UPI: ${seller.upiId}`,
  ].filter((l): l is string => Boolean(l));
  const terms = input.terms ? w.wrap(input.terms, W * 0.58, 8) : [];
  w.ensure(Math.max(bank.length * 11 + terms.length * 10 + 40, 70));
  const footTop = w.y;
  if (bank.length) {
    w.text("Payment details", M, 8, { bold: true });
    w.y -= 12;
    for (const l of bank) {
      w.text(l, M, 8.5, { color: SLATE });
      w.y -= 11;
    }
    w.y -= 6;
  }
  if (terms.length) {
    w.text("Terms", M, 8, { bold: true });
    w.y -= 11;
    for (const l of terms) {
      w.text(l, M, 8, { color: SLATE });
      w.y -= 10;
    }
  }
  const leftEnd = w.y;
  w.y = footTop;
  w.text(`For ${seller.name}`, 0, 9, { bold: true, right: M + W });
  w.y -= 44;
  w.page.drawLine({
    start: { x: M + W - 150, y: w.y + 10 },
    end: { x: M + W, y: w.y + 10 },
    thickness: 0.6,
    color: LINE,
  });
  w.text(input.signatureLabel ?? "Authorised signatory", 0, 8, { color: SLATE, right: M + W });
  w.y = Math.min(leftEnd, w.y) - 18;
  if (input.footerText) {
    w.ensure(14);
    w.text(input.footerText, 0, 9, {
      color: NAVY,
      right: M + W / 2 + w.font.widthOfTextAtSize(safe(input.footerText), 9) / 2,
    });
  }

  // Page numbers once the page count is known.
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const label = `Page ${i + 1} of ${pages.length}`;
    p.drawText(label, { x: M + W - font.widthOfTextAtSize(label, 7.5), y: M - 22, size: 7.5, font, color: SLATE });
  });
  return doc.save();
}
