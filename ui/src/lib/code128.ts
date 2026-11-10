// Code 128 (code set B) for barcode labels: printable ASCII 32–126, mod-103 checksum.

// Bar/space module widths of symbol values 0–106 (103–105 are Start A/B/C, 106 is Stop).
const PATTERNS = [
  "212222",
  "222122",
  "222221",
  "121223",
  "121322",
  "131222",
  "122213",
  "122312",
  "132212",
  "221213",
  "221312",
  "231212",
  "112232",
  "122132",
  "122231",
  "113222",
  "123122",
  "123221",
  "223211",
  "221132",
  "221231",
  "213212",
  "223112",
  "312131",
  "311222",
  "321122",
  "321221",
  "312212",
  "322112",
  "322211",
  "212123",
  "212321",
  "232121",
  "111323",
  "131123",
  "131321",
  "112313",
  "132113",
  "132311",
  "211313",
  "231113",
  "231311",
  "112133",
  "112331",
  "132131",
  "113123",
  "113321",
  "133121",
  "313121",
  "211331",
  "231131",
  "213113",
  "213311",
  "213131",
  "311123",
  "311321",
  "331121",
  "312113",
  "312311",
  "332111",
  "314111",
  "221411",
  "431111",
  "111224",
  "111422",
  "121124",
  "121421",
  "141122",
  "141221",
  "112214",
  "112412",
  "122114",
  "122411",
  "142112",
  "142211",
  "241211",
  "221114",
  "413111",
  "241112",
  "134111",
  "111242",
  "121142",
  "121241",
  "114212",
  "124112",
  "124211",
  "411212",
  "421112",
  "421211",
  "212141",
  "214121",
  "412121",
  "111143",
  "111341",
  "131141",
  "114113",
  "114311",
  "411113",
  "411311",
  "113141",
  "114131",
  "311141",
  "411131",
  "211412",
  "211214",
  "211232",
  "2331112",
];

export const CODE128_PATTERNS: readonly string[] = PATTERNS;
export const START_B = 104;
export const STOP = 106;
// Quiet zone each side, in modules.
export const QUIET_ZONE = 10;

export const isCode128B = (text: string) =>
  text.length > 0 && [...text].every((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126);

// Symbol values: start, data, checksum, stop.
export function code128Values(text: string): number[] {
  if (!isCode128B(text)) throw new Error(`Code 128 B can't encode “${text}”`);
  const data = [...text].map((c) => c.charCodeAt(0) - 32);
  const checksum = data.reduce((sum, v, i) => sum + v * (i + 1), START_B) % 103;
  return [START_B, ...data, checksum, STOP];
}

// Alternating bar/space widths in modules, starting with a bar (quiet zones not included).
export function code128Bars(text: string): number[] {
  return code128Values(text).flatMap((v) => [...PATTERNS[v]!].map(Number));
}
