import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export type QuoteLine = { name: string; unit: string; qty: number; price: number };

const NAVY = rgb(0.1, 0.12, 0.4);
const GREY = rgb(0.4, 0.4, 0.45);
const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const out: string[] = [];
  let cur = "";
  for (const ch of text) {
    if (cur && font.widthOfTextAtSize(cur + ch, size) > width) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out.length ? out : [""];
}

export async function buildQuotation(opts: {
  customer: string;
  project: string;
  lines: QuoteLine[];
  vat: boolean;
  date: Date;
}) {
  const fontsDir = path.join(process.cwd(), "fonts");
  const [regularBytes, boldBytes] = await Promise.all([
    readFile(path.join(fontsDir, "Sarabun-Regular.ttf")),
    readFile(path.join(fontsDir, "Sarabun-Bold.ttf")),
  ]);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(regularBytes, { subset: true });
  const bold = await doc.embedFont(boldBytes, { subset: true });

  const W = 595;
  const H = 842;
  const M = 40;
  const cols = { no: M, name: M + 28, qty: 340, price: 410, amount: W - M };
  let page!: PDFPage;
  let y = 0;

  const right = (text: string, x: number, size = 10, f = font) =>
    page.drawText(text, { x: x - f.widthOfTextAtSize(text, size), y, size, font: f });

  const header = () => {
    page.drawText("Expert Electronic & Communication", { x: M, y: H - M - 8, size: 16, font: bold, color: NAVY });
    page.drawText("ใบเสนอราคา / Quotation", { x: M, y: H - M - 30, size: 13, font: bold });
    page.drawText(`วันที่ / Date: ${opts.date.toISOString().slice(0, 10)}`, { x: W - M - 150, y: H - M - 8, size: 10, font });
    page.drawText(`ลูกค้า / Customer: ${opts.customer}`, { x: M, y: H - M - 52, size: 10, font });
    page.drawText(`โครงการ / Project: ${opts.project}`, { x: M, y: H - M - 66, size: 10, font });
    y = H - M - 92;
    page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 20, color: NAVY });
    const white = rgb(1, 1, 1);
    page.drawText("#", { x: cols.no + 2, y, size: 10, font: bold, color: white });
    page.drawText("รายการ / Description", { x: cols.name, y, size: 10, font: bold, color: white });
    const rh = (t: string, x: number) =>
      page.drawText(t, { x: x - bold.widthOfTextAtSize(t, 10), y, size: 10, font: bold, color: white });
    rh("จำนวน / Qty", cols.qty + 40);
    rh("ราคา / Price", cols.price + 50);
    rh("รวม / Amount", cols.amount - 4);
    y -= 24;
  };

  const newPage = () => {
    page = doc.addPage([W, H]);
    header();
  };
  newPage();

  let subtotal = 0;
  opts.lines.forEach((l, i) => {
    const amount = l.qty * l.price;
    subtotal += amount;
    const rows = wrap(l.name, font, 10, cols.qty - cols.name - 8);
    if (y - rows.length * 13 < M + 90) newPage();
    page.drawText(String(i + 1), { x: cols.no + 2, y, size: 10, font });
    rows.forEach((r, k) => page.drawText(r, { x: cols.name, y: y - k * 13, size: 10, font }));
    right(`${l.qty} ${l.unit}`, cols.qty + 40);
    right(money(l.price), cols.price + 50);
    right(money(amount), cols.amount - 4);
    y -= rows.length * 13 + 4;
    page.drawLine({ start: { x: M, y: y + 8 }, end: { x: W - M, y: y + 8 }, thickness: 0.4, color: rgb(0.85, 0.85, 0.88) });
  });

  if (y < M + 70) newPage();
  y -= 10;
  const vat = opts.vat ? subtotal * 0.07 : 0;
  const totals: [string, number, boolean][] = [["รวม / Subtotal", subtotal, false]];
  if (opts.vat) totals.push(["ภาษีมูลค่าเพิ่ม 7% / VAT 7%", vat, false]);
  totals.push(["ยอดรวมสุทธิ / Total", subtotal + vat, true]);
  totals.forEach(([label, value, strong]) => {
    const f = strong ? bold : font;
    page.drawText(label, { x: 330, y, size: 10, font: f });
    right(money(value), cols.amount - 4, 10, f);
    y -= 16;
  });
  page.drawText("ใบเสนอราคานี้เป็นราคาที่เสนอเบื้องต้น / This quotation is an estimate.", {
    x: M,
    y: M,
    size: 8,
    font,
    color: GREY,
  });
  return doc.save();
}
