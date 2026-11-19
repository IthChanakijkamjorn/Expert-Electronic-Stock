import ExcelJS from "exceljs";
import type { QuoteLine } from "@/lib/quotation";
import type { ReceiptLine } from "@/lib/receipt";

type Company = { name?: string; address?: string; tel?: string; email?: string; taxId?: string } | null;

const FONT = { name: "Sarabun", size: 11 };
const thin = { style: "thin" as const };
const box = { top: thin, left: thin, bottom: thin, right: thin };
const MONEY = "#,##0.00";

async function toBuffer(wb: ExcelJS.Workbook) {
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function sheetWith(title: string, company: Company, cols: number[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(title, { pageSetup: { paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = cols.map((width) => ({ width }));
  const last = cols.length;
  const line = (text: string, bold = false, size = FONT.size) => {
    const r = ws.addRow([text]);
    ws.mergeCells(r.number, 1, r.number, last);
    r.getCell(1).font = { ...FONT, bold, size };
  };
  if (company?.name) line(company.name, true, 14);
  if (company?.address) line(company.address);
  const contact = [company?.tel, company?.email && `อีเมล: ${company.email}`].filter(Boolean).join("    ");
  if (contact) line(contact);
  if (company?.taxId) line(`เลขประจำตัวผู้เสียภาษี: ${company.taxId}`);
  ws.addRow([]);
  return { wb, ws, line };
}

function pairs(ws: ExcelJS.Worksheet, last: number, items: [string, string | number | null | undefined][]) {
  items.forEach(([k, v]) => {
    const r = ws.addRow([k, v ?? ""]);
    ws.mergeCells(r.number, 2, r.number, last);
    r.getCell(1).font = { ...FONT, bold: true };
    r.getCell(2).font = FONT;
    r.getCell(2).alignment = { horizontal: "left", wrapText: true };
  });
}

function head(ws: ExcelJS.Worksheet, labels: string[]) {
  const r = ws.addRow(labels);
  r.eachCell((c) => {
    c.font = { ...FONT, bold: true };
    c.border = box;
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF0FC" } };
  });
}

function styleRow(r: ExcelJS.Row, align: ("left" | "center" | "right")[], moneyCols: number[]) {
  r.eachCell({ includeEmpty: true }, (c, i) => {
    c.font = FONT;
    c.border = box;
    c.alignment = { horizontal: align[i - 1] ?? "left", vertical: "top", wrapText: true };
    if (moneyCols.includes(i)) c.numFmt = MONEY;
  });
}

// Total rows use formulas so the sheet stays editable.
function totalRow(ws: ExcelJS.Worksheet, last: number, label: string, formula: string, bold = false) {
  const r = ws.addRow([]);
  ws.mergeCells(r.number, 1, r.number, last - 1);
  r.getCell(1).value = label;
  r.getCell(1).alignment = { horizontal: "right" };
  r.getCell(1).font = { ...FONT, bold };
  r.getCell(last).value = { formula };
  r.getCell(last).numFmt = MONEY;
  r.getCell(last).font = { ...FONT, bold };
  r.getCell(last).border = box;
  return r.number;
}

const dateTh = (d: Date | string) => new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" });

export async function quotationXlsx(q: {
  number: string; date: string; customer: string; attention: string | null; project: string; phone: string | null; email: string | null;
  validDays: number | null; leadDays: number | null; warrantyYears: number | null; paymentTerms: string | null; discountPct: number; vat: boolean;
  quotedBy: string | null; company: Company; lines: QuoteLine[];
}) {
  const cols = [8, 18, 22, 46, 12, 16, 10, 18];
  const { wb, ws, line } = sheetWith("Quotation", q.company, cols);
  line("ใบเสนอราคา / QUOTATION", true, 14);
  pairs(ws, cols.length, [
    ["เลขที่ / No.", q.number],
    ["วันที่ / Date", dateTh(q.date)],
    ["บริษัท / Company", q.customer],
    ["เรียน / Attn", q.attention],
    ["โครงการ / Project", q.project],
    ["โทรศัพท์ / Tel No", q.phone],
    ["อีเมล / Email", q.email],
    ["กำหนดยืนราคา (วัน)", q.validDays],
    ["ระยะเวลากำหนดส่งสินค้า (วัน)", q.leadDays],
    ["การรับประกัน (ปี)", q.warrantyYears],
    ["ผู้เสนอราคา / Quoted by", q.quotedBy],
  ]);
  ws.addRow([]);
  head(ws, ["ลำดับ", "ยี่ห้อ", "รุ่น", "รายละเอียด", "จำนวน", "ราคาต่อหน่วย", "ส่วนลด %", "จำนวนเงิน"]);
  const first = ws.rowCount + 1;
  q.lines.forEach((l, i) => {
    const r = ws.addRow([i + 1, l.brand, l.model, l.name, `${l.qty} ${l.unit}`.trim(), l.price, q.discountPct || 0, null]);
    r.getCell(8).value = { formula: `${l.qty}*F${r.number}*(1-G${r.number}/100)` };
    styleRow(r, ["center", "left", "left", "left", "center", "right", "center", "right"], [6, 8]);
  });
  const sub = totalRow(ws, cols.length, "รวมเงิน / Total", `SUM(H${first}:H${ws.rowCount})`);
  const vat = totalRow(ws, cols.length, q.vat ? "ภาษีมูลค่าเพิ่ม 7% / VAT" : "ภาษีมูลค่าเพิ่ม / VAT (ไม่รวม)", q.vat ? `H${sub}*0.07` : "0");
  totalRow(ws, cols.length, "จำนวนเงินรวมทั้งสิ้น / Grand total", `H${sub}+H${vat}`, true);
  ws.addRow([]);
  pairs(ws, cols.length, [["เงื่อนไขการชำระเงิน / PAYMENT OPTIONS", q.paymentTerms]]);
  return toBuffer(wb);
}

export async function invoiceXlsx(i: {
  number: string; date: string; customerCode: string | null; customer: string; address: string | null; taxId: string | null; branch: string | null;
  salesperson: string | null; vat: boolean; company: Company; lines: QuoteLine[];
}) {
  const cols = [8, 18, 22, 46, 12, 16, 18];
  const { wb, ws, line } = sheetWith("Tax invoice", i.company, cols);
  line("ใบกำกับภาษี / TAX INVOICE", true, 14);
  pairs(ws, cols.length, [
    ["เลขที่ / No.", i.number],
    ["วันที่ / Date", dateTh(i.date)],
    ["รหัสลูกค้า", i.customerCode],
    ["ชื่อลูกค้า", i.customer],
    ["ที่อยู่", i.address],
    ["เลขประจำตัวผู้เสียภาษี", i.taxId],
    ["สาขา", i.branch],
    ["พนักงานขาย", i.salesperson],
  ]);
  ws.addRow([]);
  head(ws, ["ลำดับ", "ยี่ห้อ", "รุ่น", "รายละเอียด", "จำนวน", "ราคาต่อหน่วย", "จำนวนเงิน"]);
  const first = ws.rowCount + 1;
  i.lines.forEach((l, n) => {
    const r = ws.addRow([n + 1, l.brand, l.model, l.name, `${l.qty} ${l.unit}`.trim(), l.price, null]);
    r.getCell(7).value = { formula: `${l.qty}*F${r.number}` };
    styleRow(r, ["center", "left", "left", "left", "center", "right", "right"], [6, 7]);
  });
  const sub = totalRow(ws, cols.length, "รวมเงิน", `SUM(G${first}:G${ws.rowCount})`);
  const vat = totalRow(ws, cols.length, i.vat ? "ภาษีมูลค่าเพิ่ม 7%" : "ภาษีมูลค่าเพิ่ม (ไม่รวม)", i.vat ? `G${sub}*0.07` : "0");
  totalRow(ws, cols.length, "จำนวนเงินรวมทั้งสิ้น", `G${sub}+G${vat}`, true);
  return toBuffer(wb);
}

export async function receiptXlsx(r: {
  number: string; date: string; customerCode: string | null; customer: string; receivedFrom: string | null; salesperson: string | null;
  lines: ReceiptLine[]; cashAmount: number; chequeBank: string | null; chequeBranch: string | null; chequeNo: string | null;
  chequeDate: string | null; chequeAmount: number; company: Company;
}) {
  const cols = [8, 56, 14, 18];
  const { wb, ws, line } = sheetWith("Receipt", r.company, cols);
  line("ใบเสร็จรับเงิน / RECEIPT", true, 14);
  pairs(ws, cols.length, [
    ["เลขที่ / No.", r.number],
    ["วันที่ / Date", dateTh(r.date)],
    ["รหัสลูกค้า", r.customerCode],
    ["ได้รับเงินจาก", r.customer],
    ["ผู้ชำระเงิน", r.receivedFrom],
    ["พนักงานขาย", r.salesperson],
  ]);
  ws.addRow([]);
  head(ws, ["ลำดับ", "รายการ", "จำนวน", "จำนวนเงิน"]);
  const first = ws.rowCount + 1;
  r.lines.forEach((l, n) => styleRow(ws.addRow([n + 1, l.desc, l.qty, Number(l.amount)]), ["center", "left", "center", "right"], [4]));
  totalRow(ws, cols.length, "รวมเงิน", `SUM(D${first}:D${ws.rowCount})`, true);
  ws.addRow([]);
  pairs(ws, cols.length, [
    ["เงินสด", r.cashAmount || ""],
    ["เช็คธนาคาร", r.chequeBank],
    ["สาขา", r.chequeBranch],
    ["เลขที่เช็ค", r.chequeNo],
    ["วันที่เช็ค", r.chequeDate ? dateTh(r.chequeDate) : ""],
    ["จำนวนเงินเช็ค", r.chequeAmount || ""],
  ]);
  return toBuffer(wb);
}

export const xlsxResponse = (buf: Buffer, name: string) =>
  new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
    },
  });
