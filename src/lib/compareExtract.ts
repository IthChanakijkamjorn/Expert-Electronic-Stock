import ExcelJS from "exceljs";
import type { QuoteLine } from "@/lib/quotation";
import { classify, findHeader, joinText, norm, readLines, SUMMARY_RE, num, type ColKind, type Grid } from "@/lib/compareTable";

export class ExtractError extends Error {}

export const cellText = (c: ExcelJS.Cell): string => {
  if (c.isMerged && c.master.address !== c.address) return "";
  const v = c.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return "";
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("formula" in v || "sharedFormula" in v) {
      const r = (v as { result?: unknown }).result;
      return r === undefined || r === null || typeof r === "object" ? "" : String(r);
    }
    if ("text" in v) return String((v as { text: unknown }).text);
    return "";
  }
  return String(v);
};

export function sheetGrid(ws: ExcelJS.Worksheet): Grid {
  const grid: Grid = [];
  const cols = ws.columnCount;
  for (let r = 1; r <= ws.rowCount; r++) {
    const row: string[] = [];
    for (let c = 1; c <= cols; c++) row.push(cellText(ws.getCell(r, c)));
    grid.push(row);
  }
  return grid;
}

async function fromXlsx(file: ArrayBuffer): Promise<QuoteLine[]> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(file);
  } catch {
    throw new ExtractError("อ่านไฟล์ Excel ไม่ได้ กรุณาใช้ .xlsx (ถ้าเป็น .xls ให้เปิดแล้ว Save As เป็น .xlsx ก่อน)");
  }
  for (const ws of wb.worksheets) {
    const grid = sheetGrid(ws);
    const h = findHeader(grid);
    if (!h) continue;
    const lines = readLines(grid, h);
    if (lines.length) return lines;
  }
  throw new ExtractError("ไม่พบตารางรายการสินค้าในไฟล์ (ต้องมีหัวคอลัมน์ เช่น รายการ / จำนวน / ราคาต่อหน่วย)");
}

function fromCsv(file: ArrayBuffer): QuoteLine[] {
  const text = new TextDecoder("utf-8").decode(file).replace(/^\uFEFF/, "");
  const grid: Grid = text.split(/\r?\n/).map((line) => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") {
        out.push(cur);
        cur = "";
      }
      else cur += ch;
    }
    out.push(cur);
    return out;
  });
  const h = findHeader(grid);
  const lines = h ? readLines(grid, h) : [];
  if (!lines.length) throw new ExtractError("ไม่พบตารางรายการสินค้าในไฟล์ CSV");
  return lines;
}

// Thai presentation forms (Windows/Mac fonts shift tone marks into the private use area).
const THAI_PUA = "\u0E10\u0E34\u0E35\u0E36\u0E37\u0E48\u0E49\u0E4A\u0E4B\u0E4C\u0E48\u0E49\u0E4A\u0E4B\u0E4C\u0E0D\u0E31\u0E4D\u0E47\u0E48\u0E49\u0E4A\u0E4B\u0E4C\u0E38\u0E39\u0E3A";
const cleanPdfText = (s: string) =>
  s
    .replace(/[\uF700-\uF71A]/g, (c) => THAI_PUA[c.charCodeAt(0) - 0xf700])
    .replace(/[\u0000-\u001f]/g, "")
    .replace(/\u0E4D([\u0E48-\u0E4B]?)\u0E32/g, "$1\u0E33");

type Chunk = { s: string; x0: number; x1: number };
type Col = { x0: number; x1: number; kind: ColKind | null };

const isNumeric = (s: string) => /^[\s\d,.\-]+$/.test(s) && num(s) !== 0;

function headerCols(line: Chunk[], next: Chunk[] | undefined): { cols: Col[]; used: number } | null {
  const cols: Col[] = line.map((c) => ({ x0: c.x0, x1: c.x1, kind: classify(c.s) }));
  const ok = (cs: Col[]) => {
    const k = new Set(cs.map((c) => c.kind).filter(Boolean) as ColKind[]);
    return k.size >= 3 && (k.has("price") || k.has("qty")) && (k.has("desc") || k.has("model") || k.has("brand"));
  };
  if (cols.filter((c) => c.kind).length < 2) return null;
  let used = 1;
  if (next && next.some((c) => classify(c.s)) && !next.some((c) => isNumeric(c.s))) {
    const merged = cols.map((c) => ({ ...c }));
    for (const ch of next) {
      const mid = (ch.x0 + ch.x1) / 2;
      const hit = merged.find((c) => Math.abs((c.x0 + c.x1) / 2 - mid) < 18 || (mid >= c.x0 && mid <= c.x1));
      if (hit) {
        hit.x0 = Math.min(hit.x0, ch.x0);
        hit.x1 = Math.max(hit.x1, ch.x1);
        hit.kind ??= classify(ch.s);
      } else merged.push({ x0: ch.x0, x1: ch.x1, kind: classify(ch.s) });
    }
    if (ok(merged)) return { cols: merged.sort((a, b) => a.x0 - b.x0), used: 2 };
  }
  used = 1;
  return ok(cols) ? { cols: cols.sort((a, b) => a.x0 - b.x0), used } : null;
}

type Cell = { s: string; x1: number };

/**
 * Merges visual lines into one row per item. Text-only lines between two item lines belong either to the item
 * above (top-aligned wrap) or below (centred / bottom-aligned in a tall row). The row boundary is the biggest
 * vertical gap (cell padding); when gaps are even, continue the item above only if its text ran to full width.
 */
function groupRows(cols: Col[], lines: { y: number; cells: Cell[] }[]): Grid {
  const numericKinds = new Set<ColKind | null>(["qty", "price", "amount"]);
  const isAnchor = (l: Cell[]) => l.some((c, k) => numericKinds.has(cols[k].kind) && /\d/.test(c.s));
  const minX0 = cols.map((c) => c.x0);
  const maxX1 = cols.map((_, k) => Math.max(0, ...lines.map((l) => l.cells[k].x1)));
  const full = (c: Cell, k: number) => !!c.s && c.x1 >= minX0[k] + 0.75 * (maxX1[k] - minX0[k]);
  const anchors = lines.map((l, i) => (isAnchor(l.cells) ? i : -1)).filter((i) => i >= 0);
  if (!anchors.length) return [];
  const owner = lines.map(() => 0);
  anchors.forEach((a, n) => (owner[a] = n));
  for (let i = 0; i < anchors[0]; i++) owner[i] = 0;
  for (let i = anchors[anchors.length - 1] + 1; i < lines.length; i++) owner[i] = anchors.length - 1;
  for (let n = 0; n + 1 < anchors.length; n++) {
    const a = anchors[n];
    const b = anchors[n + 1];
    if (b - a < 2) continue;
    const gaps: number[] = [];
    for (let i = a; i < b; i++) gaps.push(lines[i].y - lines[i + 1].y);
    const sorted = [...gaps].sort((x, y) => y - x);
    let split: number; // index in gaps: lines a..a+split stay with item n
    if (sorted[0] - sorted[1] > 1.5) split = gaps.indexOf(sorted[0]);
    else {
      // Even spacing: walk down while the text above ran to full width.
      split = 0;
      let last = lines[a].cells;
      for (let i = a + 1; i < b; i++) {
        const l = lines[i].cells;
        const cont = l.every((c, k) => !c.s || full(last[k], k));
        if (!cont) break;
        split = i - a;
        last = last.map((c, k) => (l[k].s ? l[k] : c));
      }
    }
    for (let i = a + 1; i < b; i++) owner[i] = i - a <= split ? n : n + 1;
  }
  const rows = anchors.map(() => cols.map(() => ""));
  lines.forEach((l, i) => l.cells.forEach((c, k) => c.s && (rows[owner[i]][k] = joinText(rows[owner[i]][k], c.s))));
  return rows;
}

async function fromPdf(file: ArrayBuffer): Promise<QuoteLine[]> {
  const { getDocumentProxy } = await import("unpdf");
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(file));
  } catch {
    throw new ExtractError("อ่านไฟล์ PDF ไม่ได้");
  }
  let cols: Col[] | null = null;
  let anyText = false;
  const grid: Grid = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = (content.items as { str?: string; transform?: number[]; width?: number }[])
      .filter((i) => i.str && i.str.trim() && i.transform)
      .map((i) => ({ s: cleanPdfText(i.str!), x: i.transform![4], y: i.transform![5], w: i.width ?? 0 }));
    if (items.length) anyText = true;
    // Group into visual lines (top to bottom), then into chunks separated by gaps.
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: { y: number; items: typeof items }[] = [];
    for (const it of items) {
      const l = lines.find((l) => Math.abs(l.y - it.y) < 2.5);
      if (l) l.items.push(it);
      else lines.push({ y: it.y, items: [it] });
    }
    lines.sort((a, b) => b.y - a.y);
    const chunked: Chunk[][] = lines.map((l) => {
      const out: Chunk[] = [];
      for (const it of l.items.sort((a, b) => a.x - b.x)) {
        const prev = out[out.length - 1];
        if (prev && it.x - prev.x1 < 3) {
          prev.s += (it.x - prev.x1 > 1.5 && !/\s$/.test(prev.s) ? " " : "") + it.s;
          prev.x1 = Math.max(prev.x1, it.x + it.w);
        } else out.push({ s: it.s, x0: it.x, x1: it.x + it.w });
      }
      return out;
    });

    let start = 0;
    for (let i = 0; i < chunked.length; i++) {
      const h = headerCols(chunked[i], chunked[i + 1]);
      if (h) {
        cols = h.cols;
        start = i + h.used;
        if (!grid.length) grid.push(cols.map((c) => (c.kind ? c.kind : "")));
        break;
      }
    }
    if (!cols) continue;
    const pageCols = cols;
    const body: { y: number; chunks: Chunk[] }[] = [];
    for (let i = start; i < chunked.length; i++) {
      if (chunked[i].some((c) => SUMMARY_RE.test(norm(c.s))) && (grid.length > 1 || body.length)) break;
      body.push({ y: lines[i].y, chunks: chunked[i] });
    }
    // Column boundaries: midway between headers, moved left to where left-aligned text starts.
    const bounds = pageCols.slice(1).map((c, i) => {
      const prev = pageCols[i];
      let b = (prev.x1 + c.x0) / 2;
      for (const line of body)
        for (const ch of line.chunks) if (!isNumeric(ch.s) && ch.x0 > prev.x1 && ch.x0 < c.x0) b = Math.min(b, ch.x0 - 0.5);
      return b;
    });
    const cells = body.map(({ y, chunks: line }) => {
      const row = pageCols.map(() => ({ s: "", x1: 0 }));
      for (const ch of line) {
        const mid = (ch.x0 + ch.x1) / 2;
        let k = bounds.findIndex((b) => mid < b);
        if (k < 0) k = pageCols.length - 1;
        row[k] = { s: row[k].s ? `${row[k].s} ${ch.s}` : ch.s, x1: Math.max(row[k].x1, ch.x1) };
      }
      return { y, cells: row };
    });
    grid.push(...groupRows(pageCols, cells));
  }
  if (!anyText) throw new ExtractError("PDF นี้เป็นภาพสแกน ไม่มีข้อความให้อ่าน กรุณาใช้ไฟล์ Excel หรือ PDF ที่สร้างจากโปรแกรม");
  if (!cols) throw new ExtractError("ไม่พบตารางรายการสินค้าใน PDF (ต้องมีหัวคอลัมน์ เช่น รายการ / จำนวน / ราคาต่อหน่วย)");
  const map = new Map<ColKind, number>();
  cols.forEach((c, i) => c.kind && !map.has(c.kind) && map.set(c.kind, i));
  const lines = readLines(grid, { row: 0, span: 1, cols: map });
  if (!lines.length) throw new ExtractError("พบหัวตารางใน PDF แต่ไม่พบรายการสินค้า");
  return lines;
}

export async function extractLines(file: ArrayBuffer, name: string): Promise<QuoteLine[]> {
  const head = new Uint8Array(file.slice(0, 5));
  const isPdf = String.fromCharCode(...head) === "%PDF-";
  const isZip = head[0] === 0x50 && head[1] === 0x4b;
  if (isPdf) return fromPdf(file);
  if (isZip) return fromXlsx(file);
  if (/\.csv$/i.test(name)) return fromCsv(file);
  if (/\.xls$/i.test(name)) throw new ExtractError("ไฟล์ .xls รุ่นเก่า: กรุณาเปิดแล้ว Save As เป็น .xlsx ก่อน");
  throw new ExtractError("รองรับไฟล์ .xlsx, .pdf และ .csv เท่านั้น");
}
