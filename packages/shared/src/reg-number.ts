// Indian vehicle registration numbers: state (2 letters) + RTO (1–2 digits) + series (0–3 letters) + number (1–4 digits).
// Bharat series (BH) numbers look like 22 BH 1234 AA.
const STANDARD = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/;
const BHARAT = /^(\d{2})(BH)(\d{4})([A-Z]{1,2})$/;

// "kl07cb4412", "KL-07-CB-4412" -> "KL 07 CB 4412". Returns null when the input isn't a registration number.
export function normalizeRegNumber(input: string): string | null {
  const compact = input.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const bh = BHARAT.exec(compact);
  if (bh) return `${bh[1]} ${bh[2]} ${bh[3]} ${bh[4]}`;

  const m = STANDARD.exec(compact);
  if (!m) return null;
  const [, state, rto, series, number] = m;
  return [state, rto!.padStart(2, "0"), series, number!.padStart(4, "0")].filter(Boolean).join(" ");
}

export const isValidRegNumber = (input: string) => normalizeRegNumber(input) !== null;
