import { formatINR, formatQty } from "@erp-software/shared";
import { env } from "../../config/env";
import type { MailContent } from "./mail.types";

// Every email shares one simple layout: inline styles only, since email apps ignore stylesheets.
// Add new emails (invoice, payment receipt, dues reminder…) as functions here so they look the same.

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function htmlToText(html: string): string {
  return html
    .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, "$2: $1")
    .replace(/<(br|\/p|\/h1|\/h2|\/tr|\/div)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface LayoutInput {
  title: string;
  // Paragraphs of plain text (escaped here).
  paragraphs: string[];
  button?: { label: string; url: string };
  footnote?: string;
}

function layout({ title, paragraphs, button, footnote }: LayoutInput): { html: string; text: string } {
  const p = paragraphs
    .map((t) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#1f2933">${escapeHtml(t)}</p>`)
    .join("");
  const btn = button
    ? `<p style="margin:22px 0"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:#1f3a5f;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600;font-size:15px">${escapeHtml(button.label)}</a></p>
<p style="margin:0 0 14px;font-size:13px;color:#52606d">If the button doesn't work, copy this link into your browser:<br><a href="${escapeHtml(button.url)}" style="color:#1f3a5f;word-break:break-all">${escapeHtml(button.url)}</a></p>`
    : "";
  const foot = footnote ? `<p style="margin:18px 0 0;font-size:12px;color:#7b8794">${escapeHtml(footnote)}</p>` : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f5f7fa;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="background:#ffffff;border:1px solid #e4e7eb;border-radius:8px;padding:28px 24px">
<p style="margin:0 0 18px;font-size:13px;font-weight:700;letter-spacing:.04em;color:#52606d;text-transform:uppercase">${escapeHtml(env.APP_NAME)}</p>
<h1 style="margin:0 0 16px;font-size:20px;color:#1f2933">${escapeHtml(title)}</h1>
${p}${btn}${foot}
</div></div></body></html>`;

  const text = [
    title,
    "",
    ...paragraphs.flatMap((t) => [t, ""]),
    ...(button ? [`${button.label}: ${button.url}`, ""] : []),
    ...(footnote ? [footnote] : []),
  ]
    .join("\n")
    .trim();
  return { html, text };
}

const link = (path: string, token?: string) =>
  `${env.APP_URL.replace(/\/$/, "")}${path}${token ? `?token=${encodeURIComponent(token)}` : ""}`;

export function resetPasswordMail(input: { firstName: string; token: string; minutes: number }): MailContent {
  const { html, text } = layout({
    title: "Reset your password",
    paragraphs: [`Hello ${input.firstName},`, "We got a request to reset your password. Choose a new one here:"],
    button: { label: "Choose a new password", url: link("/reset-password", input.token) },
    footnote: `This link works once, for ${input.minutes} minutes. If you didn't ask for this, ignore this email; your password stays the same.`,
  });
  return { subject: "Reset your password", html, text };
}

export function shopRegisteredMail(input: {
  shopName: string;
  ownerName: string;
  mobile: string;
  email: string;
  city: string;
}): MailContent {
  const { html, text } = layout({
    title: `New shop waiting for approval: ${input.shopName}`,
    paragraphs: [
      `Shop: ${input.shopName}, ${input.city}`,
      `Owner: ${input.ownerName}`,
      `Mobile: ${input.mobile}`,
      `Email: ${input.email}`,
    ],
    button: { label: "Review shops", url: link("/admin/shops") },
  });
  return { subject: `New shop registered: ${input.shopName}`, html, text };
}

// Sent to the owner right after sign-up; also confirms their email address.
export function shopReceivedMail(input: {
  firstName: string;
  shopName: string;
  verifyToken: string;
  hours: number;
}): MailContent {
  const { html, text } = layout({
    title: "We got your registration",
    paragraphs: [
      `Hello ${input.firstName},`,
      `Thank you for registering ${input.shopName}. We will check the details and approve your shop soon. You will get an email as soon as you can log in.`,
      "Meanwhile, please confirm your email address. We use it to send you password reset links.",
    ],
    button: { label: "Confirm email", url: link("/verify-email", input.verifyToken) },
    footnote: `The link works for ${input.hours} hours. If you didn't register, you can ignore this email.`,
  });
  return { subject: `Registration received: ${input.shopName}`, html, text };
}

export function shopStatusMail(input: {
  firstName: string;
  shopName: string;
  status: "ACTIVE" | "SUSPENDED" | "REJECTED";
  note: string | null;
}): MailContent {
  const note = input.note ? [`Note: ${input.note}`] : [];
  if (input.status === "ACTIVE") {
    const { html, text } = layout({
      title: "Your shop is ready",
      paragraphs: [
        `Hello ${input.firstName},`,
        `${input.shopName} is approved. Log in with your mobile number and password to start billing.`,
        ...note,
      ],
      button: { label: "Log in", url: link("/login") },
    });
    return { subject: `${input.shopName} is approved`, html, text };
  }
  const suspended = input.status === "SUSPENDED";
  const { html, text } = layout({
    title: suspended ? "Your shop's account is on hold" : "Your registration was not approved",
    paragraphs: [
      `Hello ${input.firstName},`,
      suspended
        ? `Logins for ${input.shopName} are paused. Your data is safe. Please contact support to continue.`
        : `We could not approve ${input.shopName}. Please contact support if you think this is a mistake.`,
      ...note,
    ],
  });
  return {
    subject: suspended ? `${input.shopName}: account on hold` : `${input.shopName}: registration not approved`,
    html,
    text,
  };
}

// ---------- Bill (tax invoice) emailed to the customer after billing ----------

export interface InvoiceMailInput {
  business: {
    name: string;
    gstin: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
  };
  invoice: {
    number: string;
    date: Date;
    dueDate: Date | null;
    customerName: string | null;
    customerGstin: string | null;
    lines: { description: string; quantity: string; unit: string; rate: string; gstRate: number; total: string }[];
    discountTotal: string;
    taxableTotal: string;
    cgstTotal: string;
    sgstTotal: string;
    igstTotal: string;
    roundOff: string;
    grandTotal: string;
    paidTotal: string;
    balanceDue: string;
    amountInWords: string;
  };
}

const money = (v: string | number) => formatINR(v, { exact: true });

export function invoiceMail({ business, invoice }: InvoiceMailInput): MailContent {
  const date = (d: Date) =>
    new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: env.APP_TIMEZONE,
    }).format(d);
  const td = "padding:8px 6px;border-bottom:1px solid #e4e7eb;font-size:14px;color:#1f2933";
  const th = "padding:8px 6px;border-bottom:2px solid #1f3a5f;font-size:12px;color:#52606d;text-align:left";
  const num = "text-align:right;white-space:nowrap";

  const rows = invoice.lines
    .map(
      (l) => `<tr>
<td style="${td}">${escapeHtml(l.description)}<br><span style="font-size:12px;color:#7b8794">GST ${l.gstRate}%</span></td>
<td style="${td};${num}">${escapeHtml(formatQty(l.quantity))} ${escapeHtml(l.unit)}</td>
<td style="${td};${num}">${money(l.rate)}</td>
<td style="${td};${num}">${money(l.total)}</td></tr>`,
    )
    .join("");

  const totals: [string, string, boolean?][] = [
    ...(Number(invoice.discountTotal)
      ? ([["Discount", `− ${money(invoice.discountTotal)}`]] as [string, string][])
      : []),
    ["Taxable value", money(invoice.taxableTotal)],
    ...(Number(invoice.igstTotal)
      ? ([["IGST", money(invoice.igstTotal)]] as [string, string][])
      : ([
          ["CGST", money(invoice.cgstTotal)],
          ["SGST", money(invoice.sgstTotal)],
        ] as [string, string][])),
    ...(Number(invoice.roundOff) ? ([["Round off", money(invoice.roundOff)]] as [string, string][]) : []),
    ["Total", money(invoice.grandTotal), true],
    ["Paid", money(invoice.paidTotal)],
    ...(Number(invoice.balanceDue) > 0
      ? ([["Pay later (dues)", money(invoice.balanceDue), true]] as [string, string, boolean][])
      : []),
  ];
  const totalRows = totals
    .map(
      ([label, value, strong]) =>
        `<tr><td style="padding:4px 6px;font-size:14px;color:#52606d">${escapeHtml(label)}</td><td style="padding:4px 6px;font-size:14px;${num};${strong ? "font-weight:700;color:#1f2933" : "color:#1f2933"}">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  const seller = [
    business.address,
    business.phone && `Phone ${business.phone}`,
    business.gstin && `GSTIN ${business.gstin}`,
  ]
    .filter(Boolean)
    .map((s) => escapeHtml(String(s)))
    .join("<br>");
  const due =
    Number(invoice.balanceDue) > 0 && invoice.dueDate
      ? `<p style="margin:14px 0 0;font-size:14px;color:#8a5a00">Please pay ${escapeHtml(money(invoice.balanceDue))} by ${escapeHtml(date(invoice.dueDate))}.</p>`
      : "";

  const html = `<!doctype html><html><body style="margin:0;background:#f5f7fa;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:640px;margin:0 auto;padding:24px 16px">
<div style="background:#ffffff;border:1px solid #e4e7eb;border-radius:8px;padding:24px">
<table role="presentation" width="100%" style="border-collapse:collapse"><tr>
<td style="vertical-align:top"><p style="margin:0;font-size:18px;font-weight:700;color:#1f2933">${escapeHtml(business.name)}</p>
<p style="margin:4px 0 0;font-size:12px;line-height:1.5;color:#52606d">${seller}</p></td>
<td style="vertical-align:top;text-align:right"><p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.04em;color:#52606d">TAX INVOICE</p>
<p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#1f2933">${escapeHtml(invoice.number)}</p>
<p style="margin:2px 0 0;font-size:13px;color:#52606d">${escapeHtml(date(invoice.date))}</p></td></tr></table>
<p style="margin:20px 0 4px;font-size:12px;color:#52606d">Bill to</p>
<p style="margin:0;font-size:15px;color:#1f2933">${escapeHtml(invoice.customerName ?? "Customer")}${invoice.customerGstin ? `<br><span style="font-size:12px;color:#52606d">GSTIN ${escapeHtml(invoice.customerGstin)}</span>` : ""}</p>
<table role="presentation" width="100%" style="border-collapse:collapse;margin-top:18px">
<tr><th style="${th}">Item</th><th style="${th};${num}">Qty</th><th style="${th};${num}">Rate</th><th style="${th};${num}">Amount</th></tr>
${rows}</table>
<table role="presentation" style="border-collapse:collapse;margin:12px 0 0 auto;min-width:260px">${totalRows}</table>
<p style="margin:12px 0 0;font-size:12px;color:#52606d;text-align:right">${escapeHtml(invoice.amountInWords)}</p>
${due}
<p style="margin:18px 0 0;font-size:13px;color:#52606d">The tax invoice is attached as a PDF for your records.</p>
<p style="margin:14px 0 0;font-size:14px;color:#1f2933">Thank you for your business!</p>
${business.phone || business.email ? `<p style="margin:6px 0 0;font-size:12px;color:#7b8794">Questions about this bill? Contact ${escapeHtml([business.phone, business.email].filter(Boolean).join(" · "))}.</p>` : ""}
</div></div></body></html>`;

  const text = [
    `${business.name}${business.gstin ? ` (GSTIN ${business.gstin})` : ""}`,
    `Tax invoice ${invoice.number} · ${date(invoice.date)}`,
    `Bill to: ${invoice.customerName ?? "Customer"}`,
    "",
    ...invoice.lines.map(
      (l) => `${l.description}  ${formatQty(l.quantity)} ${l.unit} × ${money(l.rate)} = ${money(l.total)}`,
    ),
    "",
    ...totals.map(([label, value]) => `${label}: ${value}`),
    invoice.amountInWords,
    "",
    "The tax invoice is attached as a PDF.",
    "Thank you for your business!",
  ].join("\n");

  return { subject: `Your bill ${invoice.number} from ${business.name}`, html, text };
}
