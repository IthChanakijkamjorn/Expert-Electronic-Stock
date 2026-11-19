import { unitLabel } from "@/lib/unit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { mergeDocCompany, type DocCompany } from "@/lib/company";
import { bahtText } from "@/lib/bahttext";

export type QuoteLine = { brand: string; model: string; name: string; unit: string; qty: number; price: number };

export type QuoteData = {
  number: string;
  date: Date;
  customer: string;
  attention: string | null;
  project: string;
  phone: string | null;
  email: string | null;
  validDays: number | null;
  leadDays: number | null;
  warrantyYears: number | null;
  paymentTerms: string | null;
  discountPct: number;
  vat: boolean;
  quotedBy: string | null;
  lines: QuoteLine[];
  signature?: Uint8Array | null;
  company?: Partial<DocCompany> | null;
};

const BLACK = rgb(0, 0, 0);
export const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function wrap(text: string, font: PDFFont, size: number, width: number) {
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

export function fit(text: string, font: PDFFont, size: number, width: number) {
  if (font.widthOfTextAtSize(text, size) <= width) return text;
  let t = text;
  while (t && font.widthOfTextAtSize(t + "…", size) > width) t = t.slice(0, -1);
  return t + "…";
}

async function embedSignature(doc: PDFDocument, bytes: Uint8Array) {
  try {
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    return await (isPng ? doc.embedPng(bytes) : doc.embedJpg(bytes));
  } catch {
    return null;
  }
}

export async function buildQuotation(q: QuoteData) {
  const [regularBytes, boldBytes, logoBytes] = await Promise.all([
    readFile(path.join(process.cwd(), "fonts", "Sarabun-Regular.ttf")),
    readFile(path.join(process.cwd(), "fonts", "Sarabun-Bold.ttf")),
    readFile(path.join(process.cwd(), "public", "logo.png")),
  ]);
  const co = mergeDocCompany(q.company, "quote");
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(regularBytes, { subset: true });
  const bold = await doc.embedFont(boldBytes, { subset: true });
  const logo = await doc.embedPng(logoBytes);

  const W = 595;
  const H = 842;
  const M = 28;
  const FOOT = 200;
  const LINE = 0.6;
  const tableW = W - 2 * M;
  const widths = [30, 58, 100, 156, 52, 56, 32, 55];
  const xs = widths.reduce<number[]>((acc, w, i) => [...acc, acc[i] + w], [M]);
  const sizeText = 9.5;
  const sizeRow = 10.5;

  let page!: PDFPage;
  let y = 0;
  let tableTop = 0;

  const text = (s: string, x: number, yy: number, size = sizeText, f = font) =>
    page.drawText(s, { x, y: yy, size, font: f, color: BLACK });
  const centered = (s: string, x: number, w: number, yy: number, size = sizeText, f = font) =>
    text(s, x + (w - f.widthOfTextAtSize(s, size)) / 2, yy, size, f);
  const rightAt = (s: string, xr: number, yy: number, size = sizeText, f = font) =>
    text(s, xr - f.widthOfTextAtSize(s, size), yy, size, f);
  const box = (x: number, yBottom: number, w: number, h: number) =>
    page.drawRectangle({ x, y: yBottom, width: w, height: h, borderWidth: LINE, borderColor: BLACK });
  const hline = (yy: number, x1 = M, x2 = W - M) =>
    page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: LINE, color: BLACK });

  const pageHeader = (first: boolean) => {
    if (!first) {
      text(`${q.number} · ${q.customer}`, M, H - M - 8, 9, bold);
      y = H - M - 24;
    } else {
      page.drawImage(logo, { x: M, y: H - M - 62, width: 62, height: 62 });
      const tx = M + 74;
      text(co.name, tx, H - M - 14, 15, bold);
      text(co.address, tx, H - M - 30, 8.5);
      text(co.tel, tx, H - M - 42, 8.5);
      text(`อีเมล: ${co.email}  ${co.web}    เลขประจำตัวผู้เสียภาษี: ${co.taxId}`, tx, H - M - 54, 8.5);
      y = H - M - 84;

      text("ใบเสนอราคา / QUOTATION", M, y, 14, bold);
      const rx = 340;
      const rw = W - M - rx;
      text("เลขที่ / No.:", rx, y, sizeText, bold);
      text(q.number, rx + bold.widthOfTextAtSize("เลขที่ / No.:", sizeText) + 6, y);
      y -= 17;

      const left = [
        `บริษัท / Company: ${q.customer}`,
        `เรียน / Attn: ${q.attention ?? ""}`,
        `โครงการ / Project: ${q.project}`,
        "",
      ];
      const right = [
        `วันที่ / Date: ${q.date.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" })}`,
        `กำหนดยืนราคา / Validity: ${q.validDays ?? "-"} วัน`,
        `ระยะเวลากำหนดส่งสินค้า / Lead time: ${q.leadDays ?? "-"} วัน`,
        `การรับประกัน / Warranty: ${q.warrantyYears ?? "-"} ปี`,
        `ผู้เสนอราคา / Quoted by: ${q.quotedBy ?? ""}`,
      ];
      left.forEach((l, i) => {
        text(fit(l, font, sizeText, rx - M - 8), M, y - i * 14);
        text(fit(right[i], font, sizeText, rw), rx, y - i * 14);
      });
      // Tel and email keep a fixed gap, even when blank, so they can be written by hand.
      const telText = `โทรศัพท์ / Tel No: ${q.phone ?? ""}`;
      const emailX = M + Math.max(font.widthOfTextAtSize(telText, sizeText) + 14, 138);
      text(telText, M, y - 3 * 14);
      text(fit(`อีเมล / Email: ${q.email ?? ""}`, font, sizeText, rx - 8 - emailX), emailX, y - 3 * 14);
      y -= 5 * 14 + 4;
      text("บริษัทฯยินดีที่จะเสนอราคาสินค้า เพื่อประกอบการพิจารณาดังนี้:", M, y, sizeText);
      y -= 14;
    }

    tableTop = y;
    const h = 28;
    page.drawRectangle({ x: M, y: y - h, width: tableW, height: h, color: rgb(0.93, 0.94, 0.99) });
    const heads: [string, string][] = [
      ["ลำดับที่", "Item"],
      ["ยี่ห้อ", "Brand"],
      ["รุ่น", "Model"],
      ["รายละเอียด", "Description"],
      ["จำนวน", "Quantity"],
      ["ราคาต่อหน่วย", "Unit Price"],
      ["ส่วนลด", "%"],
      ["จำนวนเงิน(บาท)", "Amount"],
    ];
    heads.forEach(([th, en], i) => {
      centered(th, xs[i], widths[i], y - 11, 8, bold);
      centered(en, xs[i], widths[i], y - 22, 8, bold);
    });
    y -= h;
  };

  const closeTable = (bottom: number) => {
    hline(tableTop);
    hline(tableTop - 28);
    xs.forEach((x) =>
      page.drawLine({ start: { x, y: tableTop }, end: { x, y: bottom }, thickness: LINE, color: BLACK }),
    );
    hline(bottom);
  };

  const newPage = (first: boolean) => {
    page = doc.addPage([W, H]);
    pageHeader(first);
  };
  newPage(true);

  const factor = 1 - q.discountPct / 100;
  let gross = 0;
  q.lines.forEach((l, i) => {
    const amount = l.qty * l.price * factor;
    gross += amount;
    const nameRows = wrap(l.name, font, sizeRow, widths[3] - 8);
    const modelRows = wrap(l.model, font, sizeRow, widths[2] - 8);
    const brandRows = wrap(l.brand, font, sizeRow, widths[1] - 8);
    const rows = Math.max(nameRows.length, modelRows.length, brandRows.length);
    const rowH = rows * 13 + 6;
    if (y - rowH < M + 8) {
      closeTable(y);
      newPage(false);
    }
    const top = y - 11;
    centered(String(i + 1), xs[0], widths[0], top, sizeRow);
    brandRows.forEach((r, k) => text(r, xs[1] + 4, top - k * 13, sizeRow));
    modelRows.forEach((r, k) => text(r, xs[2] + 4, top - k * 13, sizeRow));
    nameRows.forEach((r, k) => text(r, xs[3] + 4, top - k * 13, sizeRow));
    centered(`${l.qty} ${unitLabel(l.unit)}`, xs[4], widths[4], top, sizeRow);
    rightAt(money(l.price), xs[6] - 4, top, sizeRow);
    centered(q.discountPct ? String(q.discountPct) : "-", xs[6], widths[6], top, sizeRow);
    rightAt(money(amount), xs[8] - 4, top, sizeRow);
    y -= rowH;
  });

  // The totals block needs the full footer height; otherwise it goes on a fresh page.
  if (y - M < FOOT + 20) {
    closeTable(y);
    newPage(false);
  }
  closeTable(M + FOOT);

  const vat = q.vat ? gross * 0.07 : 0;
  const total = gross + vat;
  const fy = M + FOOT;
  const totalsX = 395;
  const row1H = 66;

  box(M, fy - row1H, totalsX - M, row1H);
  centered(bahtText(total), M, totalsX - M, fy - row1H / 2 - 4, 12, bold);
  const rows: [string, string, boolean][] = [
    ["ราคาสินค้า", money(gross), false],
    ["ภาษีมูลค่าเพิ่ม 7%", q.vat ? money(vat) : "-", false],
    ["รวมราคาทั้งสิ้น", money(total), true],
  ];
  rows.forEach(([label, value, strong], i) => {
    const by = fy - (i + 1) * (row1H / 3);
    box(totalsX, by, W - M - totalsX, row1H / 3);
    text(label, totalsX + 5, by + 7, sizeText, strong ? bold : font);
    rightAt(value, W - M - 5, by + 7, sizeText, strong ? bold : font);
  });

  const row2H = 84;
  const y2 = fy - row1H - row2H;
  const split = 300;
  box(M, y2, split - M, row2H);
  box(split, y2, W - M - split, row2H);
  text("เงื่อนไขการชำระเงิน / PAYMENT OPTIONS:", M + 6, y2 + row2H - 13, sizeText, bold);
  text(q.paymentTerms ?? "", M + 6 + bold.widthOfTextAtSize("เงื่อนไขการชำระเงิน / PAYMENT OPTIONS:", sizeText) + 6, y2 + row2H - 13);
  hline(y2 + row2H - 18, M, split);
  centered("ยืนยันการสั่งซื้อ / ORDER CONFIRMATION", M, split - M, y2 + row2H - 32, sizeText, bold);
  page.drawLine({ start: { x: M + 60, y: y2 + 26 }, end: { x: split - 60, y: y2 + 26 }, thickness: 0.4, color: BLACK });
  centered("ลงชื่อ / Signature", M, split - M, y2 + 16, 8);
  centered("วันที่ / Date ____ / ________ / ________", M, split - M, y2 + 4, 7.5);
  centered("ผู้อนุมัติ / APPROVED BY", split, W - M - split, y2 + row2H - 13, sizeText, bold);
  if (q.signature) {
    const img = await embedSignature(doc, q.signature);
    if (img) {
      const maxW = W - M - split - 40;
      const maxH = 26;
      const scale = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      page.drawImage(img, { x: split + (W - M - split - w) / 2, y: y2 + 32 + (maxH - h) / 2, width: w, height: h });
    }
  }
  centered(co.approverName, split, W - M - split, y2 + 16);
  centered(`( ${co.approverTitle} )`, split, W - M - split, y2 + 4);

  return doc.save();
}
