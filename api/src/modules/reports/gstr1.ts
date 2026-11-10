import { B2CL_THRESHOLD_PAISE, toPaise, UQC_BY_UNIT } from "@erp-software/shared";
import type { GstCreditNoteRateRow, GstInvoiceRateRow, HsnRow } from "./report.types";

// GSTR-1 in the shape of the GST offline tool / portal JSON (b2b, b2cl, b2cs, cdnr, cdnur, hsn).
// Classification:
//   B2B   – the invoice carries the customer's GSTIN.
//   B2CL  – no GSTIN, inter-state, invoice value above ₹1 lakh.
//   B2CS  – every other unregistered sale, summed per place of supply and rate, net of their credit notes.
//   CDNR  – credit notes on B2B invoices; CDNUR – credit notes on B2CL invoices.

export type Gstr1Section = "B2B" | "B2CL" | "B2CS";

const amt = (paise: number) => Math.round(paise) / 100;
const p = (v: string) => toPaise(v);

// dd-mm-yyyy in the app timezone.
export const gstDate = (d: Date, timeZone: string) => {
  const [y, m, day] = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(d)
    .split("-");
  return `${day}-${m}-${y}`;
};

export const classifyInvoice = (r: {
  customerGstin: string | null;
  supplyType: string;
  grandTotal: string;
}): Gstr1Section =>
  r.customerGstin ? "B2B" : r.supplyType === "INTER_STATE" && p(r.grandTotal) > B2CL_THRESHOLD_PAISE ? "B2CL" : "B2CS";

const itemDetail = (num: number, r: { rate: string; taxable: string; igst: string; cgst: string; sgst: string }) => ({
  num,
  itm_det: {
    txval: amt(p(r.taxable)),
    rt: Number(r.rate),
    iamt: amt(p(r.igst)),
    camt: amt(p(r.cgst)),
    samt: amt(p(r.sgst)),
    csamt: 0,
  },
});

// Groups per-rate rows of the same document, keeping first-seen order.
function byDocument<T extends { id: string }>(rows: T[]): T[][] {
  const map = new Map<string, T[]>();
  for (const r of rows) map.set(r.id, [...(map.get(r.id) ?? []), r]);
  return [...map.values()];
}

export interface Gstr1Input {
  gstin: string;
  // "MMYYYY"
  period: string;
  timeZone: string;
  invoices: GstInvoiceRateRow[];
  creditNotes: GstCreditNoteRateRow[];
  hsn: HsnRow[];
}

export function buildGstr1(input: Gstr1Input) {
  const { timeZone } = input;
  const b2b = new Map<string, unknown[]>();
  const b2cl = new Map<string, unknown[]>();
  const b2cs = new Map<
    string,
    { sply_ty: string; pos: string; rt: number; txval: number; iamt: number; camt: number; samt: number }
  >();

  const addB2cs = (r: GstInvoiceRateRow, sign: 1 | -1) => {
    const key = `${r.supplyType}|${r.placeOfSupply}|${r.rate}`;
    const e = b2cs.get(key) ?? {
      sply_ty: r.supplyType === "INTER_STATE" ? "INTER" : "INTRA",
      pos: r.placeOfSupply,
      rt: Number(r.rate),
      txval: 0,
      iamt: 0,
      camt: 0,
      samt: 0,
    };
    e.txval += sign * p(r.taxable);
    e.iamt += sign * p(r.igst);
    e.camt += sign * p(r.cgst);
    e.samt += sign * p(r.sgst);
    b2cs.set(key, e);
  };

  for (const doc of byDocument(input.invoices)) {
    const head = doc[0]!;
    const section = classifyInvoice(head);
    if (section === "B2CS") {
      doc.forEach((r) => addB2cs(r, 1));
      continue;
    }
    const inv = {
      inum: head.number,
      idt: gstDate(head.date, timeZone),
      val: amt(p(head.grandTotal)),
      pos: head.placeOfSupply,
      ...(section === "B2B" && { rchrg: "N", inv_typ: "R" }),
      itms: doc.map((r, i) => itemDetail(i + 1, r)),
    };
    const key = section === "B2B" ? head.customerGstin! : head.placeOfSupply;
    const target = section === "B2B" ? b2b : b2cl;
    target.set(key, [...(target.get(key) ?? []), inv]);
  }

  const cdnr = new Map<string, unknown[]>();
  const cdnur: unknown[] = [];
  for (const doc of byDocument(input.creditNotes)) {
    const head = doc[0]!;
    const section = classifyInvoice({ ...head, grandTotal: head.invoiceGrandTotal });
    if (section === "B2CS") {
      doc.forEach((r) => addB2cs(r, -1));
      continue;
    }
    const note = {
      ntty: "C",
      nt_num: head.number,
      nt_dt: gstDate(head.date, timeZone),
      val: amt(p(head.grandTotal)),
      pos: head.placeOfSupply,
      itms: doc.map((r, i) => itemDetail(i + 1, r)),
    };
    if (section === "B2B") {
      cdnr.set(head.customerGstin!, [...(cdnr.get(head.customerGstin!) ?? []), { ...note, rchrg: "N", inv_typ: "R" }]);
    } else {
      cdnur.push({ ...note, typ: "B2CL" });
    }
  }

  const hsn = input.hsn.map((r, i) => {
    const service = r.kind === "LABOUR";
    return {
      num: i + 1,
      hsn_sc: r.hsn,
      desc: (r.description ?? "").slice(0, 30),
      uqc: service ? "NA" : (UQC_BY_UNIT[r.unit] ?? "OTH"),
      qty: service ? 0 : Number(r.quantity),
      rt: Number(r.rate),
      txval: amt(p(r.taxable)),
      iamt: amt(p(r.igst)),
      camt: amt(p(r.cgst)),
      samt: amt(p(r.sgst)),
      csamt: 0,
    };
  });

  const rupees = (e: { txval: number; iamt: number; camt: number; samt: number }) => ({
    txval: amt(e.txval),
    iamt: amt(e.iamt),
    camt: amt(e.camt),
    samt: amt(e.samt),
  });

  return {
    gstin: input.gstin,
    fp: input.period,
    version: "GST3.2.1",
    hash: "hash",
    b2b: [...b2b].map(([ctin, inv]) => ({ ctin, inv })),
    b2cl: [...b2cl].map(([pos, inv]) => ({ pos, inv })),
    b2cs: [...b2cs.values()]
      .filter((e) => e.txval !== 0 || e.iamt !== 0 || e.camt !== 0 || e.samt !== 0)
      .map((e) => ({ sply_ty: e.sply_ty, pos: e.pos, typ: "OE", rt: e.rt, ...rupees(e), csamt: 0 })),
    cdnr: [...cdnr].map(([ctin, nt]) => ({ ctin, nt })),
    cdnur,
    hsn: { data: hsn },
  };
}

export type Gstr1Json = ReturnType<typeof buildGstr1>;
