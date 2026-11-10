// Minimal RFC 4180 CSV: quoted fields, "" escapes, CRLF or LF line ends. Blank lines are skipped.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // strip a UTF-8 BOM (Excel)

  const endRow = () => {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
    field = "";
  };

  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"' && field === "") {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      endRow();
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) endRow();
  return rows;
}

// First row = headers; returns one object per data row keyed by the header names.
export function csvToObjects(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const [headers = [], ...data] = parseCsv(text);
  const keys = headers.map((h) => h.trim());
  return {
    headers: keys,
    rows: data.map((cells) => Object.fromEntries(keys.map((k, i) => [k, (cells[i] ?? "").trim()]))),
  };
}

const escapeCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (rows: unknown[][]): string => rows.map((r) => r.map(escapeCell).join(",")).join("\r\n");
