import ExcelJS from "exceljs";
import { bahtText } from "@/lib/bahttext";
import { unitLabel } from "@/lib/unit";
import type { QuoteLine } from "@/lib/quotation";
import { findHeader, norm, SUMMARY_RE, thTest, type ColKind } from "@/lib/compareTable";
import { cellText, sheetGrid } from "@/lib/compareExtract";

export class FillError extends Error {}

const END_RE = /^\s*(หมายเหตุ|remark|note)/i;
const GRAND_RE = /ทั้งสิ้น|สุทธิ|grand|net\s*total|total\s*amount/i;
const VAT_RE = /^\s*(vat\b|ภาษี)/i;
const DISCOUNT_RE = /ส่วนลด|discount/i;
const MONEY = "#,##0.00";

export function randomPrice(price: number, minPct: number, maxPct: number) {
  if (!(price > 0) || maxPct <= 0) return price;
  const step = price >= 1000 ? 10 : 1;
  for (let i = 0; i < 20; i++) {
    const pct = (minPct + Math.random() * (maxPct - minPct)) / 100;
    const sign = Math.random() < 0.5 ? -1 : 1;
    const p = Math.round((price * (1 + sign * pct)) / step) * step;
    if (p > 0 && p !== price) return p;
  }
  return price;
}

type Merge = { top: number; left: number; bottom: number; right: number };
const merges = (ws: ExcelJS.Worksheet): Merge[] =>
  Object.values((ws as unknown as { _merges: Record<string, { model: Merge }> })._merges).map((m) => ({ ...m.model }));

const isFormula = (v: unknown): v is { formula?: string; sharedFormula?: string; result?: unknown } =>
  !!v && typeof v === "object" && ("formula" in v || "sharedFormula" in v);

const shiftRefs = (f: string, at: number, n: number) =>
  f.replace(/(?<![A-Za-z0-9_!.'"])(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\d(A-Za-z_])/g, (all, d1, col, d2, row) =>
    Number(row) >= at ? `${d1}${col}${d2}${Number(row) + n}` : all,
  );

/** Inserts `n` rows at `at`, styled like row `src`, keeping merges, formulas, images and print area in place. */
function insertRows(ws: ExcelJS.Worksheet, at: number, n: number, src: number) {
  ws.eachRow({ includeEmpty: true }, (row) =>
    row.eachCell({ includeEmpty: true }, (c) => {
      if (!isFormula(c.value)) return;
      const result = c.value.result;
      const formula = c.formula;
      if (formula) c.value = { formula: shiftRefs(formula, at, n), result } as ExcelJS.CellFormulaValue;
    }),
  );
  const affected = merges(ws).filter((m) => m.bottom >= at);
  affected.forEach((m) => ws.unMergeCells(m.top, m.left, m.bottom, m.right));
  ws.spliceRows(at, 0, ...Array.from({ length: n }, () => []));
  const from = src >= at ? src + n : src;
  const srcRow = ws.getRow(from);
  for (let i = 0; i < n; i++) {
    const dst = ws.getRow(at + i);
    dst.height = srcRow.height;
    srcRow.eachCell({ includeEmpty: true }, (c, col) => {
      dst.getCell(col).style = JSON.parse(JSON.stringify(c.style ?? {}));
    });
  }
  affected.forEach((m) => {
    if (m.top >= at) ws.mergeCells(m.top + n, m.left, m.bottom + n, m.right);
    else ws.mergeCells(m.top, m.left, m.bottom + n, m.right);
  });
  merges(ws)
    .filter((m) => m.top === from && m.bottom === from)
    .forEach((m) => {
      for (let i = 0; i < n; i++) ws.mergeCells(at + i, m.left, at + i, m.right);
    });
  for (const img of ws.getImages()) {
    const r = img.range as unknown as { tl: { nativeRow: number }; br?: { nativeRow: number } };
    if (r.tl.nativeRow >= at - 1) {
      r.tl.nativeRow += n;
      if (r.br) r.br.nativeRow += n;
    }
  }
  if (ws.pageSetup.printArea) ws.pageSetup.printArea = shiftRefs(ws.pageSetup.printArea, at, n);
}

/** Writes product lines into another company's quotation form (.xlsx) and recalculates its totals. */
export async function fillCompareFile(file: ArrayBuffer, lines: QuoteLine[], minPct: number, maxPct: number) {
  const items = lines.filter((l) => l.name?.trim() || l.model?.trim() || l.brand?.trim());
  if (!items.length) throw new FillError("ไม่มีรายการสินค้า");
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(file);
  } catch {
    throw new FillError("อ่านไฟล์ฟอร์มไม่ได้ กรุณาใช้ไฟล์ .xlsx (ถ้าเป็น .xls ให้เปิดแล้ว Save As เป็น .xlsx ก่อน)");
  }

  let ws: ExcelJS.Worksheet | undefined;
  let header: ReturnType<typeof findHeader> = null;
  for (const s of wb.worksheets) {
    header = findHeader(sheetGrid(s));
    if (header) {
      ws = s;
      break;
    }
  }
  if (!ws || !header) throw new FillError("ไม่พบหัวตารางในฟอร์ม (ต้องมีหัวคอลัมน์ เช่น รายการ / จำนวน / ราคาต่อหน่วย)");
  const sheet = ws;
  const col = (k: ColKind) => (header.cols.has(k) ? header.cols.get(k)! + 1 : 0);
  const C = { no: col("no"), brand: col("brand"), model: col("model"), desc: col("desc"), qty: col("qty"), unit: col("unit"), price: col("price"), amount: col("amount") };
  if (!C.price && !C.amount) throw new FillError("ไม่พบคอลัมน์ “ราคาต่อหน่วย / Unit Price” ในฟอร์ม");
  const keyCol = C.desc || C.model || C.brand;

  const rowTexts = (r: number) => {
    const out: string[] = [];
    sheet.getRow(r).eachCell((c) => {
      const t = cellText(c).trim();
      if (t) out.push(t);
    });
    return out;
  };
  const start = header.row + 1 + header.span;
  const findEnd = () => {
    for (let r = start; r <= sheet.rowCount; r++) if (rowTexts(r).some((t) => SUMMARY_RE.test(norm(t)) || thTest(END_RE, t))) return r;
    return sheet.rowCount + 1;
  };
  const slotRows = (end: number) => {
    const rows: number[] = [];
    for (let r = start; r < end; r++) if (Number(sheet.getCell(r, keyCol).master.row) === r) rows.push(r);
    // Drop trailing spacer rows without borders (the gap between the table and the totals).
    while (rows.length > 1) {
      const r = rows[rows.length - 1];
      const b = sheet.getCell(r, keyCol).border;
      if (rowTexts(r).length || b?.left || b?.right) break;
      rows.pop();
    }
    return rows;
  };

  let end = findEnd();
  let slots = slotRows(end);
  if (slots.length < items.length) {
    const last = slots[slots.length - 1];
    // New rows go above the form's last item row so SUM ranges grow to include them.
    insertRows(sheet, last ?? start, items.length - slots.length, slots.length > 1 ? slots[slots.length - 2] : (last ?? start - 1));
    end = findEnd();
    slots = slotRows(end);
  }

  const cell = (r: number, c: number) => sheet.getCell(r, c).master;
  // Loaded cells can share one style object, so styles are copied before changing them.
  const restyle = (x: ExcelJS.Cell, patch: Partial<ExcelJS.Style>) => {
    x.style = { ...JSON.parse(JSON.stringify(x.style ?? {})), ...patch };
  };
  const align: Partial<Record<number, ExcelJS.Alignment["horizontal"]>> = {
    [C.no]: "center", [C.brand]: "center", [C.qty]: "center", [C.unit]: "center", [C.price]: "right", [C.amount]: "right",
  };
  const set = (r: number, c: number, v: ExcelJS.CellValue, money = false) => {
    if (!c) return;
    const x = cell(r, c);
    x.value = v;
    if (v === null) return;
    const patch: Partial<ExcelJS.Style> = {};
    if (money && (!x.numFmt || x.numFmt === "General")) patch.numFmt = MONEY;
    if (!x.alignment?.horizontal) patch.alignment = { ...x.alignment, horizontal: align[c] ?? "left", vertical: x.alignment?.vertical ?? "middle", wrapText: c === C.desc || c === C.model || undefined };
    if (Object.keys(patch).length) restyle(x, patch);
    if (typeof v === "string" && (c === C.desc || c === C.model) && x.alignment?.wrapText) fitHeight(r, x, v);
  };
  const fitHeight = (r: number, x: ExcelJS.Cell, v: string) => {
    const m = merges(sheet).find((m) => m.top === Number(x.row) && m.left === Number(x.col));
    let width = 0;
    for (let k = Number(x.col); k <= (m?.right ?? Number(x.col)); k++) width += sheet.getColumn(k).width ?? 9;
    const lines = Math.ceil(v.length / Math.max(width * 1.15, 1));
    const need = lines * (x.font?.size ?? 11) * 1.35 + 4;
    const row = sheet.getRow(r);
    if (lines > 1 && (row.height ?? 15) < need) row.height = need;
  };
  let sum = 0;
  slots.forEach((r, i) => {
    const it = items[i];
    if (!it) {
      // Leftover rows (e.g. the form's own sample items) are cleared.
      new Set(Object.values(C).filter(Boolean)).forEach((c) => set(r, c, null));
      return;
    }
    const unit = unitLabel(it.unit ?? "").trim();
    const qty = Number(it.qty) || 0;
    const extra = [!C.brand && it.brand && `ยี่ห้อ ${it.brand}`, !C.model && it.model && `รุ่น ${it.model}`].filter(Boolean).join(" ");
    set(r, C.no, i + 1);
    set(r, C.brand, it.brand ?? "");
    set(r, C.model, C.desc ? (it.model ?? "") : [it.model, it.name].filter(Boolean).join(" "));
    if (C.desc) set(r, C.desc, [it.name, extra].filter(Boolean).join(" "));
    const qtyIsNumber = !!C.unit || !unit;
    set(r, C.qty, qtyIsNumber ? qty : `${qty} ${unit}`);
    set(r, C.unit, unit);
    const price = randomPrice(Number(it.price) || 0, minPct, maxPct);
    const lineTotal = Math.round(price * qty * 100) / 100;
    sum += lineTotal;
    if (C.price) set(r, C.price, price, true);
    if (C.amount) {
      const qRef = C.qty && qtyIsNumber ? cell(r, C.qty).address : String(qty);
      set(r, C.amount, C.price ? { formula: `${cell(r, C.price).address}*${qRef}`, result: lineTotal } : lineTotal, true);
    }
  });
  sum = Math.round(sum * 100) / 100;

  // Totals block: write values, or refresh cached results of the form's own formulas.
  let vatPct = 0;
  for (let r = end; r <= sheet.rowCount; r++) {
    const t = rowTexts(r).find((x) => thTest(VAT_RE, x));
    if (t) vatPct = Number(/(\d+(?:\.\d+)?)\s*%/.exec(t)?.[1] ?? 7);
  }
  const vat = Math.round(sum * vatPct) / 100;
  const grand = Math.round((sum + vat) * 100) / 100;
  let seenVat = false;
  for (let r = end; r <= sheet.rowCount; r++) {
    const cells: ExcelJS.Cell[] = [];
    sheet.getRow(r).eachCell({ includeEmpty: true }, (c) => {
      if (c.master.address === c.address) cells.push(c);
    });
    const label = cells.find((c) => SUMMARY_RE.test(norm(cellText(c))));
    if (label && !thTest(DISCOUNT_RE, cellText(label))) {
      const t = cellText(label);
      const isVat = thTest(VAT_RE, t);
      const value = isVat ? vat : thTest(GRAND_RE, t) || seenVat ? grand : sum;
      if (isVat) seenVat = true;
      const amountCell = C.amount ? sheet.getCell(r, C.amount).master : undefined;
      const target =
        amountCell && Number(amountCell.col) > Number(label.col)
          ? amountCell
          : cells.find((c) => Number(c.col) > Number(label.col) && (typeof c.value === "number" || isFormula(c.value)));
      if (target) {
        if (isFormula(target.value)) target.value = { formula: target.formula, result: value } as ExcelJS.CellFormulaValue;
        else if (typeof target.value === "number" || target.value === null || target.value === "") target.value = value;
        if (!target.numFmt || target.numFmt === "General") restyle(target, { numFmt: MONEY });
      }
    }
    cells.forEach((c) => {
      const m = /^(\(?)\s*[ก-๙]+(บาทถ้วน|สตางค์)\s*(\)?)$/.exec(cellText(c).trim());
      if (m && !isFormula(c.value)) c.value = `${m[1]}${bahtText(grand)}${m[3]}`;
    });
  }
  // Excel recalculates every formula when the file is opened.
  wb.calcProperties.fullCalcOnLoad = true;

  return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), filled: items.length };
}
