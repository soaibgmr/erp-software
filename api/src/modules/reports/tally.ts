// Tally Prime / ERP 9 import XML (Import Data → Vouchers). Ledger names are fixed below; create
// them in Tally (or rename here) before importing. In Tally XML a debit is a negative AMOUNT with
// ISDEEMEDPOSITIVE=Yes and a credit a positive AMOUNT with ISDEEMEDPOSITIVE=No.

export const TALLY_LEDGERS = {
  cash: "Cash",
  bank: "Bank",
  walkIn: "Cash Sales",
  sales: (rate: string) => `Sales @ ${Number(rate)}%`,
  outputCgst: "Output CGST",
  outputSgst: "Output SGST",
  outputIgst: "Output IGST",
  roundOff: "Round Off",
} as const;

export type TallyVoucherType = "Sales" | "Credit Note" | "Receipt" | "Payment";

export interface TallyEntry {
  ledger: string;
  // Paise; positive = debit, negative = credit.
  paise: number;
}

export interface TallyVoucher {
  type: TallyVoucherType;
  // YYYY-MM-DD
  date: string;
  number: string;
  party: string;
  narration?: string;
  entries: TallyEntry[];
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

// Merges entries on the same ledger, drops zero lines, and puts any residue on Round Off so the
// voucher balances exactly.
export function balance(entries: TallyEntry[]): TallyEntry[] {
  const merged = new Map<string, number>();
  for (const e of entries) merged.set(e.ledger, (merged.get(e.ledger) ?? 0) + e.paise);
  const residue = [...merged.values()].reduce((a, b) => a + b, 0);
  if (residue !== 0) merged.set(TALLY_LEDGERS.roundOff, (merged.get(TALLY_LEDGERS.roundOff) ?? 0) - residue);
  return [...merged].filter(([, v]) => v !== 0).map(([ledger, paise]) => ({ ledger, paise }));
}

const amount = (paise: number) => (-paise / 100).toFixed(2);

function voucherXml(v: TallyVoucher): string {
  const entries = balance(v.entries)
    // Tally lists the party first.
    .sort((a, b) => Number(b.ledger === v.party) - Number(a.ledger === v.party))
    .map(
      (e) =>
        `<ALLLEDGERENTRIES.LIST><LEDGERNAME>${esc(e.ledger)}</LEDGERNAME>` +
        `<ISDEEMEDPOSITIVE>${e.paise > 0 ? "Yes" : "No"}</ISDEEMEDPOSITIVE>` +
        `<ISPARTYLEDGER>${e.ledger === v.party ? "Yes" : "No"}</ISPARTYLEDGER>` +
        `<AMOUNT>${amount(e.paise)}</AMOUNT></ALLLEDGERENTRIES.LIST>`,
    )
    .join("");
  return (
    `<TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER VCHTYPE="${esc(v.type)}" ACTION="Create">` +
    `<DATE>${v.date.replace(/-/g, "")}</DATE><VOUCHERTYPENAME>${esc(v.type)}</VOUCHERTYPENAME>` +
    `<VOUCHERNUMBER>${esc(v.number)}</VOUCHERNUMBER><PARTYLEDGERNAME>${esc(v.party)}</PARTYLEDGERNAME>` +
    (v.narration ? `<NARRATION>${esc(v.narration)}</NARRATION>` : "") +
    `<PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>${entries}</VOUCHER></TALLYMESSAGE>`
  );
}

export function buildTallyXml(company: string, vouchers: TallyVoucher[]): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>` +
    `<BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME>` +
    `<STATICVARIABLES><SVCURRENTCOMPANY>${esc(company)}</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC>` +
    `<REQUESTDATA>\n${vouchers.map(voucherXml).join("\n")}\n</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>\n`
  );
}
