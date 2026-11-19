import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { bahtText } from "@/lib/bahttext";
import { unitLabel } from "@/lib/unit";
import type { DocCompany } from "@/lib/company";
import type { QuoteLine } from "@/lib/quotation";
import type { ReceiptLine } from "@/lib/receipt";

type Company = { name?: string; address?: string; tel?: string; email?: string; taxId?: string } | null;

const FONT = { name: "TH Sarabun New", size: 11 };
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
    c.font = { ...FONT, size: 10 };
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
  quotedBy: string | null; company: DocCompany; lines: QuoteLine[]; signature?: Uint8Array | null;
}) {
  const co = q.company;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Quotation", {
    pageSetup: { paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0, footer: 0 } },
  });
  // Column widths mirror the PDF table (30/58/100/156/52/56/32/55 pt).
  ws.columns = [6, 11, 19, 36, 10, 15, 7, 15].map((width) => ({ width }));
  const F = (size = 10, bold = false) => ({ name: "TH Sarabun New", size, bold });
  const BLACK = { argb: "FF000000" };
  const thinB = { style: "thin" as const, color: BLACK };
  const frame = { top: thinB, left: thinB, bottom: thinB, right: thinB };
  const put = (r: number, c1: number, c2: number, value: ExcelJS.CellValue, o: { size?: number; bold?: boolean; h?: "left" | "center" | "right"; v?: "top" | "middle" | "bottom"; border?: boolean } = {}) => {
    if (c2 > c1) ws.mergeCells(r, c1, r, c2);
    const c = ws.getCell(r, c1);
    c.value = value;
    c.font = F(o.size, o.bold);
    c.alignment = { horizontal: o.h ?? "left", vertical: o.v ?? "middle", wrapText: false };
    if (o.border) for (let k = c1; k <= c2; k++) ws.getCell(r, k).border = frame;
    return c;
  };

  // Header: logo + company block
  ws.getRow(1).height = 22;
  [2, 3, 4].forEach((r) => (ws.getRow(r).height = 15));
  try {
    const logo = wb.addImage({ buffer: (await readFile(path.join(process.cwd(), "public", "logo.png"))) as unknown as ExcelJS.Buffer, extension: "png" });
    ws.addImage(logo, { tl: { col: 0.1, row: 0.1 }, ext: { width: 80, height: 80 } });
  } catch {}
  put(1, 3, 8, co.name, { size: 15, bold: true });
  put(2, 3, 8, co.address, { size: 8.5 });
  put(3, 3, 8, `${co.tel}    อีเมล: ${co.email}`, { size: 8.5 });
  put(4, 3, 8, `เลขประจำตัวผู้เสียภาษี: ${co.taxId}`, { size: 8.5 });
  ws.getRow(5).height = 14;

  put(6, 1, 4, "ใบเสนอราคา / QUOTATION", { size: 14, bold: true });
  ws.getRow(6).height = 22;
  const noC = put(6, 5, 8, null, {});
  noC.value = { richText: [{ text: "เลขที่ / No.: ", font: F(10, true) }, { text: q.number, font: F(10) }] };

  const left = [`บริษัท / Company: ${q.customer}`, `เรียน / Attn: ${q.attention ?? ""}`, `โครงการ / Project: ${q.project}`];
  const right = [
    `วันที่ / Date: ${dateTh(q.date)}`,
    `กำหนดยืนราคา / Validity: ${q.validDays ?? "-"} วัน`,
    `ระยะเวลากำหนดส่งสินค้า / Lead time: ${q.leadDays ?? "-"} วัน`,
    `การรับประกัน / Warranty: ${q.warrantyYears ?? "-"} ปี`,
    `ผู้เสนอราคา / Quoted by: ${q.quotedBy ?? ""}`,
  ];
  right.forEach((t, i) => {
    ws.getRow(7 + i).height = 16;
    put(7 + i, 5, 8, t);
    if (left[i]) put(7 + i, 1, 4, left[i]);
  });
  ws.getRow(10).height = 16;
  ws.getRow(11).height = 16;
  put(10, 1, 4, `โทรศัพท์ / Tel No: ${q.phone ?? ""}`);
  put(11, 1, 4, `อีเมล / Email: ${q.email ?? ""}`);
  ws.getRow(12).height = 18;
  put(12, 1, 8, "บริษัทฯยินดีที่จะเสนอราคาสินค้า เพื่อประกอบการพิจารณาดังนี้:", { v: "bottom" });

  // Table header
  const HR = 13;
  ws.getRow(HR).height = 30;
  ["ลำดับที่\nItem", "ยี่ห้อ\nBrand", "รุ่น\nModel", "รายละเอียด\nDescription", "จำนวน\nQuantity", "ราคาต่อหน่วย\nUnit Price", "ส่วนลด\n%", "จำนวนเงิน(บาท)\nAmount"].forEach((t, i) => {
    const c = ws.getCell(HR, i + 1);
    c.value = t;
    c.font = F(8, true);
    c.border = frame;
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDF0FC" } };
  });

  const factor = 1 - q.discountPct / 100;
  let gross = 0;
  const first = HR + 1;
  q.lines.forEach((l, i) => {
    const r = first + i;
    const amount = l.qty * l.price * factor;
    gross += amount;
    const cells: [ExcelJS.CellValue, "left" | "center" | "right"][] = [
      [i + 1, "center"], [l.brand, "center"], [l.model, "left"], [l.name, "left"],
      [`${l.qty} ${unitLabel(l.unit)}`, "center"], [l.price, "right"],
      [q.discountPct ? q.discountPct : "-", "center"],
      [{ formula: `${l.qty}*F${r}*${factor}`, result: amount }, "right"],
    ];
    cells.forEach(([v, h], k) => {
      const c = ws.getCell(r, k + 1);
      c.value = v;
      c.font = F(10);
      c.border = frame;
      c.alignment = { horizontal: h, vertical: "middle", wrapText: true };
      if (k === 5 || k === 7) c.numFmt = MONEY;
    });
    // Row height follows the longest wrapped cell (same widths as the PDF wrap).
    const lines = Math.max(Math.ceil(l.name.length / 43), Math.ceil(l.model.length / 22), Math.ceil(l.brand.length / 12), 1);
    ws.getRow(r).height = Math.max(18, lines * 14 + 8);
  });
  // Always print at least 28 product rows (blank rows are numbered nothing) so the sheet fills an A4 page.
  const MIN_ROWS = 28;
  for (let i = q.lines.length; i < MIN_ROWS; i++) {
    const r = first + i;
    ws.getRow(r).height = 18;
    for (let k = 1; k <= 8; k++) ws.getCell(r, k).border = frame;
  }
  const last = first + Math.max(q.lines.length, MIN_ROWS) - 1;
  if (q.lines.length <= MIN_ROWS) ws.pageSetup.fitToHeight = 1;

  // Totals
  const vat = q.vat ? gross * 0.07 : 0;
  const total = gross + vat;
  const t1 = last + 2;
  ws.mergeCells(t1, 1, t1 + 2, 4);
  const words = ws.getCell(t1, 1);
  words.value = bahtText(total);
  words.font = F(12, true);
  words.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  for (let r = t1; r <= t1 + 2; r++) for (let k = 1; k <= 4; k++) ws.getCell(r, k).border = frame;
  const sumRows: [string, ExcelJS.CellValue, boolean][] = [
    ["ราคาสินค้า", { formula: `SUM(H${first}:H${last})`, result: gross }, false],
    ["ภาษีมูลค่าเพิ่ม 7%", q.vat ? { formula: `H${t1}*0.07`, result: vat } : "-", false],
    ["รวมราคาทั้งสิ้น", { formula: `H${t1}+${q.vat ? `H${t1 + 1}` : "0"}`, result: total }, true],
  ];
  sumRows.forEach(([label, value, strong], i) => {
    const r = t1 + i;
    ws.getRow(r).height = 22;
    put(r, 5, 7, label, { bold: strong, border: true });
    const c = put(r, 8, 8, value, { bold: strong, h: "right", border: true });
    c.numFmt = MONEY;
  });

  // Payment / confirmation / approval
  const p1 = t1 + 3;
  const heights = [20, 22, 26, 20, 16];
  heights.forEach((h, i) => (ws.getRow(p1 + i).height = h));
  for (let r = p1; r < p1 + 5; r++) for (let k = 1; k <= 8; k++) ws.getCell(r, k).border = {};
  const pay = put(p1, 1, 4, null, { h: "left" });
  pay.value = { richText: [{ text: "เงื่อนไขการชำระเงิน / PAYMENT OPTIONS: ", font: F(10, true) }, { text: q.paymentTerms ?? "", font: F(10) }] };
  put(p1, 5, 8, "ผู้อนุมัติ / APPROVED BY", { bold: true, h: "center" });
  put(p1 + 1, 1, 4, "ยืนยันการสั่งซื้อ / ORDER CONFIRMATION", { bold: true, h: "center", border: false });
  put(p1 + 4, 1, 4, "วันที่ / Date ____ / ________ / ________", { size: 7.5, h: "center" });
  put(p1 + 3, 1, 4, "ลงชื่อ / Signature", { size: 8, h: "center" });
  put(p1 + 3, 5, 8, `( ${co.approverTitle} )`, { h: "center" });
  put(p1 + 2, 5, 8, co.approverName, { h: "center" });
  // signature line above "ลงชื่อ" for the customer
  for (let k = 2; k <= 3; k++) ws.getCell(p1 + 2, k).border = { bottom: { style: "thin", color: BLACK } };
  if (q.signature) {
    try {
      const sig = wb.addImage({ buffer: Buffer.from(q.signature) as unknown as ExcelJS.Buffer, extension: "png" });
      ws.addImage(sig, { tl: { col: 5.2, row: p1 }, ext: { width: 110, height: 40 } });
    } catch {}
  }
  // outer boxes: left (payment+confirm) and right (approval)
  const outline = (c1: number, c2: number) => {
    for (let r = p1; r < p1 + 5; r++)
      for (let k = c1; k <= c2; k++) {
        const c = ws.getCell(r, k);
        c.border = { ...c.border, ...(r === p1 ? { top: thinB } : {}), ...(r === p1 + 4 ? { bottom: thinB } : {}), ...(k === c1 ? { left: thinB } : {}), ...(k === c2 ? { right: thinB } : {}) };
      }
  };
  outline(1, 4);
  outline(5, 8);
  for (let k = 1; k <= 4; k++) ws.getCell(p1, k).border = { ...ws.getCell(p1, k).border, bottom: thinB };

  ws.pageSetup.printArea = `A1:H${p1 + 4}`;
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
