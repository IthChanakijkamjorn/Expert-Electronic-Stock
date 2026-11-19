import ExcelJS from "exceljs";
import { bahtText } from "@/lib/bahttext";
import type { QuoteLine } from "@/lib/quotation";

const PRICE_RE = /ราคาต่อหน่วย|unit\s*price/i;
const TOTAL_RE = /จำนวนเงินรวม|ราคารวม|total\s*amount/i;
const SUMMARY_RE = /^(ราคา)?รวม|^total|^grand|^net\s*total|^vat|^ภาษี/i;

export class FillError extends Error {}

const text = (c: ExcelJS.Cell) => {
  const v = c.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "richText" in v) return v.richText.map((r) => r.text).join("");
  if (typeof v === "object" && "formula" in v) return "";
  if (typeof v === "object" && "text" in v) return String((v as { text: unknown }).text);
  return String(v);
};
const isSlave = (c: ExcelJS.Cell) => c.isMerged && c.master.address !== c.address;

export function randomPrice(price: number, minPct: number, maxPct: number) {
  if (!(price > 0)) return price;
  const step = price >= 1000 ? 10 : 1;
  for (let i = 0; i < 20; i++) {
    const pct = (minPct + Math.random() * (maxPct - minPct)) / 100;
    const sign = Math.random() < 0.5 ? -1 : 1;
    const p = Math.round((price * (1 + sign * pct)) / step) * step;
    if (p > 0 && p !== price) return p;
  }
  return price;
}

export async function fillCompareFile(file: ArrayBuffer, lines: QuoteLine[], minPct: number, maxPct: number) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(file);
  } catch {
    throw new FillError("อ่านไฟล์ไม่ได้ กรุณาใช้ไฟล์ .xlsx (ถ้าเป็น .xls ให้เปิดแล้ว Save As เป็น .xlsx ก่อน)");
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new FillError("ไม่พบ Sheet ในไฟล์");

  let headerRow = 0;
  let priceCol = 0;
  for (let r = 1; r <= Math.min(ws.rowCount, 80) && !headerRow; r++) {
    ws.getRow(r).eachCell((c, col) => {
      if (!headerRow && !isSlave(c) && PRICE_RE.test(text(c))) {
        headerRow = r;
        priceCol = col;
      }
    });
  }
  if (!headerRow) throw new FillError("ไม่พบหัวคอลัมน์ “ราคาต่อหน่วย / Unit Price” ในไฟล์");

  let totalCol = 0;
  for (let r = headerRow; r <= headerRow + 1 && !totalCol; r++) {
    ws.getRow(r).eachCell((c, col) => {
      if (!totalCol && col !== priceCol && !isSlave(c) && TOTAL_RE.test(text(c).trim())) totalCol = col;
    });
  }

  const rows: number[] = [];
  let summaryStart = ws.rowCount + 1;
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    let summary = false;
    ws.getRow(r).eachCell((c) => {
      if (!isSlave(c) && SUMMARY_RE.test(text(c).trim())) summary = true;
    });
    if (summary && rows.length) {
      summaryStart = r;
      break;
    }
    const v = ws.getCell(r, priceCol).master.value;
    if (typeof v === "number") rows.push(r);
  }

  const items = lines.filter((l) => l.name?.trim() || l.model?.trim());
  if (!rows.length) throw new FillError("ไม่พบแถวรายการที่มีราคาในไฟล์");
  const warning =
    rows.length === items.length
      ? ""
      : `จำนวนรายการไม่ตรงกัน: ในไฟล์มี ${rows.length} แถว แต่ใบเสนอราคามี ${items.length} รายการ — เติมราคาให้ ${Math.min(rows.length, items.length)} แถวแรก กรุณาตรวจสอบแถวที่เหลือด้วยตนเอง`;

  let sum = 0;
  rows.slice(0, items.length).forEach((r, i) => {
    const qty = Number(items[i].qty) || 0;
    const price = randomPrice(Number(items[i].price) || 0, minPct, maxPct);
    ws.getCell(r, priceCol).master.value = price;
    const lineTotal = Math.round(price * qty * 100) / 100;
    sum += lineTotal;
    if (totalCol) {
      const tc = ws.getCell(r, totalCol).master;
      tc.value = { formula: `${ws.getCell(r, priceCol).master.address}*${qty}`, result: lineTotal };
    }
  });
  sum = Math.round(sum * 100) / 100;

  // Fixed (non-formula) summary cells are recalculated; formula cells recalc in Excel.
  const vat = Math.round(sum * 7) / 100;
  const hasVat = (() => {
    for (let r = summaryStart; r <= ws.rowCount; r++) {
      let found = false;
      ws.getRow(r).eachCell((c) => {
        if (!isSlave(c) && /^vat|^ภาษี/i.test(text(c).trim())) found = true;
      });
      if (found) return true;
    }
    return false;
  })();
  const grand = hasVat ? Math.round((sum + vat) * 100) / 100 : sum;
  for (let r = summaryStart; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cells: ExcelJS.Cell[] = [];
    row.eachCell((c) => {
      if (!isSlave(c)) cells.push(c);
    });
    const label = cells.find((c) => SUMMARY_RE.test(text(c).trim()));
    if (label) {
      const t = text(label).trim();
      const value = /grand|net\s*total|รวมทั้งสิ้น|รวมสุทธิ/i.test(t) ? grand : /^vat|^ภาษี/i.test(t) ? vat : sum;
      const target = cells.find((c) => c.col > label.col && typeof c.value === "number");
      if (target) target.value = value;
    }
    cells.forEach((c) => {
      const t = text(c).trim();
      if (/(บาทถ้วน|สตางค์)$/.test(t)) c.value = bahtText(grand);
    });
  }

  return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), warning };
}
