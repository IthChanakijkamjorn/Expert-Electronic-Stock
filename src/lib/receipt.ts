import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { bahtText } from "@/lib/bahttext";
import { mergeDocCompany, type DocCompany } from "@/lib/company";
import { docHead, type DocVariant } from "@/lib/docType";
import { fit, money } from "@/lib/quotation";

export type ReceiptLine = { desc: string; qty: string; amount: number };

export type ReceiptData = {
  number: string;
  date: Date;
  variant?: DocVariant;
  customerCode: string | null;
  customer: string;
  receivedFrom: string | null;
  salesperson: string | null;
  lines: ReceiptLine[];
  cashAmount: number;
  chequeBank: string | null;
  chequeBranch: string | null;
  chequeNo: string | null;
  chequeDate: Date | null;
  chequeAmount: number;
  company?: Partial<DocCompany> | null;
};

export const RECEIPT_MAX_LINES = 14;

export async function buildReceipt(r: ReceiptData) {
  const [regularBytes, boldBytes, logoBytes] = await Promise.all([
    readFile(path.join(process.cwd(), "fonts", "THSarabunNew-Regular.ttf")),
    readFile(path.join(process.cwd(), "fonts", "THSarabunNew-Bold.ttf")),
    readFile(path.join(process.cwd(), "public", "logo.png")),
  ]);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(regularBytes, { subset: true });
  const bold = await doc.embedFont(boldBytes, { subset: true });
  const logo = await doc.embedPng(logoBytes);
  const BLACK = rgb(0, 0, 0);

  const W = 595;
  const H = 842;
  const M = 28;
  const LINE = 0.6;
  const size = 9.5;
  const tableW = W - 2 * M;
  const page = doc.addPage([W, H]);

  const text = (s: string, x: number, y: number, sz = size, f = font) => page.drawText(s, { x, y, size: sz, font: f, color: BLACK });
  const centered = (s: string, x: number, w: number, y: number, sz = size, f = font) =>
    text(s, x + (w - f.widthOfTextAtSize(s, sz)) / 2, y, sz, f);
  const rightAt = (s: string, xr: number, y: number, sz = size, f = font) => text(s, xr - f.widthOfTextAtSize(s, sz), y, sz, f);
  const box = (x: number, y: number, w: number, h: number) =>
    page.drawRectangle({ x, y, width: w, height: h, borderWidth: LINE, borderColor: BLACK });
  const vline = (x: number, y1: number, y2: number) => page.drawLine({ start: { x, y: y1 }, end: { x, y: y2 }, thickness: LINE, color: BLACK });
  const hline = (y: number, x1 = M, x2 = W - M) => page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: LINE, color: BLACK });
  const fmtDate = (d: Date) => d.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" });

  const co = mergeDocCompany(r.company, "receipt");
  const head = docHead("ใบเสร็จรับเงิน", "RECEIPT", r.variant);

  page.drawImage(logo, { x: M, y: H - M - 58, width: 58, height: 58 });
  const tx = M + 68;
  text(co.name, tx, H - M - 14, 11, bold);
  text(co.address, tx, H - M - 29, 8);
  text(co.tel, tx, H - M - 41, 8.5);
  text(`Email: ${co.email}  ${co.web}`, tx, H - M - 53, 8.5);

  const bx = 388;
  const bw = W - M - bx;
  box(bx, H - M - 22, bw, 22);
  centered(head.th, bx, bw, H - M - 15, 11, bold);
  box(bx, H - M - 44, bw, 22);
  centered(head.en, bx, bw, H - M - 37, 11, bold);
  box(bx, H - M - 64, bw, 20);
  centered(`เลขประจำตัวผู้เสียภาษีอากร: ${co.taxId}`, bx, bw, H - M - 58, 8);

  let y = H - M - 82;
  const rx = bx;
  const lw = rx - M - 8;
  text(fit(`รหัสลูกค้า / Customer Code: ${r.customerCode ?? ""}`, font, size, lw), M, y);
  text(fit(`ชื่อลูกค้า / Customer: ${r.customer}`, font, size, lw), M, y - 14);
  text(fit(`ได้รับเงินจาก / Received from: ${r.receivedFrom ?? ""}`, font, size, lw), M, y - 28);
  text(`เลขที่ / No.: ${r.number}`, rx, y);
  text(`วันที่ / Date: ${fmtDate(r.date)}`, rx, y - 14);
  text(fit(`พนักงานขาย / Sales: ${r.salesperson ?? ""}`, font, size, W - M - rx), rx, y - 28);
  y -= 48;

  const widths = [44, 330, 70, tableW - 44 - 330 - 70];
  const xs = widths.reduce<number[]>((a, w, i) => [...a, a[i] + w], [M]);
  const HEAD_H = 28;
  const ROW_H = 22;
  const top = y;
  page.drawRectangle({ x: M, y: y - HEAD_H, width: tableW, height: HEAD_H, color: rgb(0.93, 0.94, 0.99) });
  (
    [["ลำดับ", "Item"], ["รายละเอียด", "Description"], ["จำนวน", "Quantity"], ["จำนวนเงิน (บาท)", "Amount"]] as const
  ).forEach(([th, en], i) => {
    centered(th, xs[i], widths[i], y - 11, 8.5, bold);
    centered(en, xs[i], widths[i], y - 22, 8.5, bold);
  });
  y -= HEAD_H;
  const bodyRows = RECEIPT_MAX_LINES;
  r.lines.slice(0, bodyRows).forEach((l, i) => {
    const ty = y - i * ROW_H - 15;
    centered(String(i + 1), xs[0], widths[0], ty, 14);
    text(fit(l.desc, font, 14, widths[1] - 8), xs[1] + 4, ty, 14);
    centered(l.qty, xs[2], widths[2], ty, 14);
    rightAt(money(l.amount), xs[4] - 4, ty, 14);
  });
  const bottom = y - bodyRows * ROW_H;
  hline(top);
  hline(top - HEAD_H);
  xs.forEach((x) => vline(x, top, bottom));
  hline(bottom);

  const total = r.lines.reduce((s, l) => s + l.amount, 0);
  box(M, bottom - 26, xs[3] - M, 26);
  box(xs[3], bottom - 26, widths[3], 26);
  centered(`(${bahtText(total)})`, M, xs[3] - M, bottom - 17, 11, bold);
  rightAt(money(total), xs[4] - 4, bottom - 17, 11, bold);

  const noteTop = bottom - 26;
  box(M, noteTop - 30, tableW, 30);
  [
    "ใบเสร็จรับเงินฉบับนี้จะสมบูรณ์ต่อเมื่อบริษัทได้รับเงินสด หรือเช็คของธนาคารได้เรียกเก็บเงินตามเช็คแล้ว",
    "(The receipt will be issued upon cash received or cheque cleared.)",
  ].forEach((l, i) => centered(l, M, tableW, noteTop - 12 - i * 11, 8));

  const payTop = noteTop - 30;
  const payH = 74;
  box(M, payTop - payH, tableW, payH);
  text("ชำระโดย / PAID BY", M + 6, payTop - 14, 9, bold);
  text("เงินสด / CASH", M + 20, payTop - 30, 9);
  if (r.cashAmount > 0) {
    text(`${money(r.cashAmount)} บาท / BAHT`, M + 130, payTop - 30, 9);
  }
  text("เช็คธนาคาร / CHEQUE", M + 20, payTop - 46, 9);
  const chq = [
    `ธนาคาร/BANK: ${r.chequeBank ?? ""}`,
    `สาขา/BRANCH: ${r.chequeBranch ?? ""}`,
    `เลขที่/NUMBER: ${r.chequeNo ?? ""}`,
    `ลงวันที่/DATE: ${r.chequeDate ? fmtDate(r.chequeDate) : ""}`,
  ];
  chq.forEach((c, i) => text(fit(c, font, 8.5, 150), M + 130 + (i % 2) * 190, payTop - 46 - Math.floor(i / 2) * 13, 8.5));
  if (r.chequeAmount > 0) text(`${money(r.chequeAmount)} บาท / BAHT`, M + 130, payTop - 72, 8.5);

  const sigTop = payTop - payH;
  const sigH = 70;
  const sw = tableW / 2;
  (
    [["ผู้รับเงิน", "COLLECTED BY"], ["ผู้มีอำนาจลงนาม", "AUTHORIZED SIGNATURE"]] as const
  ).forEach(([th, en], i) => {
    const sx = M + i * sw;
    box(sx, sigTop - sigH, sw, sigH);
    centered(th, sx, sw, sigTop - sigH + 17, 8.5, bold);
    centered(en, sx, sw, sigTop - sigH + 6, 7.5, bold);
  });

  return doc.save();
}
