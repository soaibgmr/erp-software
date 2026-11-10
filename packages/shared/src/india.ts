// Indian states and union territories with their GST state codes.
export const INDIAN_STATES = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
  { code: "97", name: "Other Territory" },
] as const;

export const STATE_CODES: readonly string[] = INDIAN_STATES.map((s) => s.code);

export function stateName(code: string | null | undefined): string | undefined {
  return INDIAN_STATES.find((s) => s.code === code)?.name;
}

// 10-digit Indian mobile number starting 6–9. Accepts spaces, dashes and a +91/0 prefix.
export function normalizeMobile(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function isValidMobile(input: string): boolean {
  return /^[6-9]\d{9}$/.test(normalizeMobile(input));
}

// "9847012345" -> "98470 12345", the format used on screens and invoices.
export function formatMobile(mobile: string): string {
  const m = normalizeMobile(mobile);
  return m.length === 10 ? `${m.slice(0, 5)} ${m.slice(5)}` : mobile;
}

export const isValidPincode = (pin: string) => /^[1-9]\d{5}$/.test(pin);

const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

// Check character of a GSTIN (15th char) from the first 14, per the GSTN mod-36 algorithm.
export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = GSTIN_CHARS.indexOf(first14[i]!);
    const product = value * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36]!;
}

export type GstinCheck = { valid: true; stateCode: string } | { valid: false; reason: string };

export function checkGstin(input: string): GstinCheck {
  const gstin = input.trim().toUpperCase();
  if (!GSTIN_PATTERN.test(gstin)) return { valid: false, reason: "GSTIN must be 15 characters like 32AAAAA0000A1Z5" };
  const stateCode = gstin.slice(0, 2);
  if (!STATE_CODES.includes(stateCode)) return { valid: false, reason: `Unknown state code ${stateCode}` };
  if (gstinCheckChar(gstin.slice(0, 14)) !== gstin[14]) return { valid: false, reason: "GSTIN check digit is wrong" };
  return { valid: true, stateCode };
}

export const isValidGstin = (input: string) => checkGstin(input).valid;
