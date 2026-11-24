import type { QuoteLine } from "@/lib/quotation";

/** Normalises Thai for keyword matching: PDFs often split ำ and drop tone marks. */
export const norm = (s: string) => s.replace(/\u0E4D([\u0E48-\u0E4B]?)\u0E32/g, "$1\u0E33").replace(/[\u0E48-\u0E4C]/g, "");
/** Same regex, but tolerant of missing Thai tone marks; test it against norm(text). */
export const thRe = (re: RegExp) => new RegExp(norm(re.source), re.flags);
export const thTest = (re: RegExp, text: string) => thRe(re).test(norm(text));

/** Joins wrapped text; Thai has no spaces between words. */
export const joinText = (a: string, b: string) => {
  if (!a || !b) return a || b;
  return /[\u0E00-\u0E7F]$/.test(a) && /^[\u0E00-\u0E7F]/.test(b) ? a + b : `${a} ${b}`;
};

// Column kinds found in quotation / price-form tables (Thai + English headers).
export type ColKind = "no" | "brand" | "model" | "desc" | "qty" | "unit" | "price" | "discount" | "amount";

const RULES: [ColKind, RegExp][] = ([
  ["discount", /ส่วนลด|discount|disc\.?$/i],
  ["price", /ราคา\s*ต่อ\s*หน่วย|ราคา\s*\/\s*หน่วย|หน่วย\s*ละ|ราคา\s*หน่วย|unit\s*-?\s*price|price\s*\/\s*unit|price\s*per\s*unit|^\s*(ราคา|price|rate)\s*$/i],
  ["amount", /จำนวน\s*เงิน|ราคา\s*รวม|รวม\s*เงิน|เป็น\s*เงิน|ราคา\s*สุทธิ|amount|total/i],
  ["qty", /จำนวน|qty|q'ty|quantity/i],
  ["unit", /หน่วย|unit|uom/i],
  ["brand", /ยี่ห้อ|แบรนด์|brand|make|manufacturer/i],
  ["model", /รุ่น|model|part\s*no|p\/n|code|รหัส/i],
  ["no", /ลำดับ|^\s*(no\.?|item|ที่|#|ข้อ)\s*$/i],
  ["desc", /รายการ|รายละเอียด|description|สินค้า|product|item|detail/i],
] as [ColKind, RegExp][]).map(([k, re]) => [k, thRe(re)]);

export function classify(text: string): ColKind | null {
  text = norm(text);
  const t = text.replace(/\s+/g, " ").trim();
  if (!t || t.length > 40) return null;
  // Bilingual headers ("ลำดับที่\nItem") are matched on their first part first.
  for (const part of [text.split(/\n|\//)[0], t]) {
    for (const [kind, re] of RULES) if (re.test(part.trim())) return kind;
  }
  return null;
}

// "ราคาสินค้า", "รวมเป็นเงิน", "Sub Total", "VAT 7%", "Grand Total", ...
export const SUMMARY_RE = thRe(
  /^\s*((ราคา)?รวม|ราคาสินค้า|ยอดรวม|ภาษี|vat\b|sub\s*-?\s*total|total|grand|net\s*total|หัก\s*ส่วนลด|ส่วนลด\s*(พิเศษ|ท้ายบิล)|มูลค่าสินค้า)/i,
);

export const num = (v: unknown) => {
  if (typeof v === "number") return v;
  const m = /-?\d[\d,]*(\.\d+)?/.exec(String(v ?? ""));
  return m ? Number(m[0].replace(/,/g, "")) || 0 : 0;
};

/** "2 ชิ้น" → { qty: 2, unit: "ชิ้น" } */
export function splitQty(v: unknown): { qty: number; unit: string } {
  if (typeof v === "number") return { qty: v, unit: "" };
  const s = String(v ?? "").trim();
  const m = /^(-?\d[\d,]*(?:\.\d+)?)\s*(.*)$/.exec(s);
  if (!m) return { qty: 0, unit: "" };
  return { qty: Number(m[1].replace(/,/g, "")) || 0, unit: m[2].trim() };
}

export type Grid = string[][]; // rows × columns of plain cell text
export type Header = { row: number; span: number; cols: Map<ColKind, number> };

const score = (kinds: Set<ColKind>) =>
  kinds.size >= 3 && (kinds.has("price") || kinds.has("qty")) && (kinds.has("desc") || kinds.has("model") || kinds.has("brand"));

/** Finds the table header (1–2 rows) in the first rows of a grid. */
export function findHeader(grid: Grid, maxRows = 120): Header | null {
  for (let r = 0; r < Math.min(grid.length, maxRows); r++) {
    const cols = new Map<ColKind, number>();
    let span = 1;
    const add = (row: string[]) =>
      row.forEach((t, c) => {
        const k = classify(t);
        if (k && !cols.has(k) && ![...cols.values()].includes(c)) cols.set(k, c);
      });
    add(grid[r]);
    if (!score(new Set(cols.keys()))) {
      // Two-row header: Thai row on top, English (or sub headers) below.
      const next = grid[r + 1];
      if (!next || grid[r].filter((t) => classify(t)).length < 2) continue;
      add(next);
      if (!score(new Set(cols.keys()))) continue;
      span = 2;
    } else if (grid[r + 1]?.some((t) => classify(t)) && !grid[r + 1].some((t) => num(t) > 0 && /^\s*[\d,.]+\s*$/.test(t))) {
      grid[r + 1].forEach((t, c) => {
        const k = classify(t);
        if (k && !cols.has(k) && ![...cols.values()].includes(c)) cols.set(k, c);
      });
      span = 2;
    }
    return { row: r, span, cols };
  }
  return null;
}

/** Reads product lines below a header until the summary block. */
export function readLines(grid: Grid, h: Header): QuoteLine[] {
  const get = (row: string[], k: ColKind) => (h.cols.has(k) ? (row[h.cols.get(k)!] ?? "").trim() : "");
  const out: QuoteLine[] = [];
  let last: QuoteLine | null = null;
  for (let r = h.row + h.span; r < grid.length; r++) {
    const row = grid[r];
    if (out.length && row.some((t) => SUMMARY_RE.test(norm(t))) && !get(row, "qty")) break;
    const desc = get(row, "desc");
    const model = get(row, "model");
    const brand = get(row, "brand");
    const q = splitQty(get(row, "qty"));
    const unit = get(row, "unit") || q.unit;
    const price = num(get(row, "price"));
    const amount = num(get(row, "amount"));
    const hasNumbers = q.qty > 0 || price > 0 || amount > 0;
    if (!desc && !model && !brand) continue;
    if (hasNumbers) {
      last = {
        brand,
        model,
        name: desc || (!model ? brand : ""),
        unit,
        qty: q.qty || 1,
        price: price || (amount && q.qty ? Math.round((amount / q.qty) * 100) / 100 : amount),
      };
      out.push(last);
    } else if (last && !get(row, "no")) {
      // Wrapped text of the previous item.
      last.name = joinText(last.name, desc);
      last.model = joinText(last.model, model);
      last.brand = joinText(last.brand, brand);
    }
  }
  return out;
}

// ---- Document info above the table: date and project name ----

export type CompareMeta = { date: string; project: string }; // date is ISO yyyy-mm-dd or ""

const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const TH_ABBR = ["มค", "กพ", "มีค", "เมย", "พค", "มิย", "กค", "สค", "กย", "ตค", "พย", "ธค"];
const EN_MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export const DATE_LABEL = /^\s*(?:วันที่(?!\s*(?:ส่ง|ครบ|หมด|ยืน|รับ|ชำระ))(?:\s*(?:เสนอราคา|ออกเอกสาร|เอกสาร))?|(?:quotation\s*|quote\s*|issue\s*|doc(?:ument)?\.?\s*)?date)(?:\s*[/|]\s*(?:วันที่|(?:quotation\s*)?date))?\s*[:：.]?\s*/i;
export const PROJECT_LABEL = /^\s*(?:ชื่อ\s*)?(?:โครงการ|project(?:\s*name)?)(?!\s*(?:manager|engineer|no\b|code))(?:\s*[/|]\s*(?:ชื่อ\s*)?(?:โครงการ|project(?:\s*name)?))?\s*[:：.]?\s*/i;
/** Blank fill-in placeholders such as "______" or "....". */
export const isPlaceholder = (s: string) => /^[\s_.\-–—…:/]*$/.test(s);

function monthIndex(word: string): number {
  const w = norm(word).toLowerCase().replace(/[.\s]/g, "");
  const th = TH_MONTHS.findIndex((m) => norm(m) === w);
  if (th >= 0) return th;
  const ab = TH_ABBR.findIndex((m) => norm(m) === w);
  if (ab >= 0) return ab;
  return EN_MONTHS.findIndex((m) => w.startsWith(m));
}

/** Parses Thai/English dates ("24 พฤศจิกายน 2569", "24 พ.ย. 69", "24/11/2026", "Nov 24, 2026") to ISO. */
export function parseDate(text: string): string {
  const t = text.trim();
  let d = 0, mo = 0, y = 0;
  let m: RegExpExecArray | null;
  if ((m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t))) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if ((m = /(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{2,4})/.exec(t))) [d, mo, y] = [+m[1], +m[2], +m[3]];
  else if ((m = /(\d{1,2})(?:st|nd|rd|th)?\s*([ก-๙.]+(?:\s*[ก-๙.]+)?|[A-Za-z]+\.?),?\s*(\d{2,4})/.exec(t)) && monthIndex(m[2]) >= 0)
    [d, mo, y] = [+m[1], monthIndex(m[2]) + 1, +m[3]];
  else if ((m = /([A-Za-z]+)\.?\s+(\d{1,2}),?\s*(\d{4})/.exec(t)) && monthIndex(m[1]) >= 0) [d, mo, y] = [+m[2], monthIndex(m[1]) + 1, +m[3]];
  else return "";
  if (y < 100) y += y >= 40 ? 2500 : 2000;
  if (y > 2400) y -= 543;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return "";
  return dt.toISOString().slice(0, 10);
}

/** ISO date → "24 พฤศจิกายน 2569" */
export const thaiDate = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[3])} ${TH_MONTHS[Number(m[2]) - 1]} ${Number(m[1]) + 543}` : "";
};

/** Reads "label: value" pairs (same cell, or the next cell to the right) from rows of text. */
export function findMeta(rows: string[][]): CompareMeta {
  const meta: CompareMeta = { date: "", project: "" };
  for (const row of rows) {
    row.forEach((text, i) => {
      for (const [key, re] of [["date", DATE_LABEL], ["project", PROJECT_LABEL]] as const) {
        if (meta[key]) continue;
        const m = re.exec(text);
        if (!m) continue;
        let value = text.slice(m[0].length).trim();
        if (isPlaceholder(value)) {
          const next = row.slice(i + 1).find((s) => s.trim() && !isPlaceholder(s))?.trim() ?? "";
          value = /[:：]\s*$/.test(next) || DATE_LABEL.test(next) || PROJECT_LABEL.test(next) ? "" : next;
        }
        if (!value || isPlaceholder(value)) continue;
        if (key === "date") {
          const iso = parseDate(value);
          if (iso) meta.date = iso;
        } else meta.project = value.split("\n")[0].trim();
      }
    });
  }
  return meta;
}
