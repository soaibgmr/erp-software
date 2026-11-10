import { toPaise } from "./money.js";

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n]!;
  return [TENS[Math.floor(n / 10)], ONES[n % 10]].filter(Boolean).join(" ");
}

function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [hundreds ? `${ONES[hundreds]} Hundred` : "", rest ? belowHundred(rest) : ""].filter(Boolean).join(" ");
}

// Indian numbering: Crore (10^7), Lakh (10^5), Thousand (10^3).
export function numberToIndianWords(value: number): string {
  if (!Number.isInteger(value) || value < 0) throw new RangeError("Expected a non-negative integer");
  if (value === 0) return "Zero";

  const parts: string[] = [];
  const crore = Math.floor(value / 10_000_000);
  let rest = value % 10_000_000;
  const lakh = Math.floor(rest / 100_000);
  rest %= 100_000;
  const thousand = Math.floor(rest / 1000);
  rest %= 1000;

  if (crore) parts.push(`${numberToIndianWords(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (rest) parts.push(belowThousand(rest));
  return parts.join(" ");
}

// 4814 -> "Indian Rupees Four Thousand Eight Hundred Fourteen Only"
// 1250.5 -> "Indian Rupees One Thousand Two Hundred Fifty and Fifty Paise Only"
export function amountInWords(amount: number | string): string {
  const paise = toPaise(amount);
  if (paise < 0) throw new RangeError("Amount in words expects a non-negative amount");
  const rupees = Math.floor(paise / 100);
  const p = paise % 100;
  const words = `Indian Rupees ${numberToIndianWords(rupees)}`;
  return p ? `${words} and ${belowHundred(p)} Paise Only` : `${words} Only`;
}
