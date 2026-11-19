import { unitLabel } from "@/lib/unit";
import { docHead, type DocVariant } from "@/lib/docType";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { mergeDocCompany, type DocCompany } from "@/lib/company";
import { fit, money, wrap, type QuoteLine } from "@/lib/quotation";

export type TaxInvoiceData = {
  number: string;
  date: Date;
  customerCode: string | null;
  customer: string;
  address: string | null;
  taxId: string | null;
  branch: string | null;
  salesperson: string | null;
  vat: boolean;
  variant?: DocVariant;
  lines: QuoteLine[];
  company?: Partial<DocCompany> | null;
};

export const invoiceTotals = (lines: QuoteLine[], vat: boolean) => {
  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const vatAmount = vat ? subtotal * 0.07 : 0;
  return { subtotal, vatAmount, total: subtotal + vatAmount };
};

const BLACK = rgb(0, 0, 0);

export async function buildTaxInvoice(inv: TaxInvoiceData) {
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

  const W = 595;
  const H = 842;
  const M = 28;
  const LINE = 0.6;
  const tableW = W - 2 * M;
  const widths = [34, 72, 88, 183, 52, 58, 52];
  const xs = widths.reduce<number[]>((acc, w, i) => [...acc, acc[i] + w], [M]);
  const size = 9.5;
  const HEAD_H = 28;
  const FOOT = 168;

  let page!: PDFPage;
  let y = 0;
  let tableTop = 0;

  const text = (s: string, x: number, yy: number, sz = size, f = font) =>
    page.drawText(s, { x, y: yy, size: sz, font: f, color: BLACK });
  const centered = (s: string, x: number, w: number, yy: number, sz = size, f = font) =>
    text(s, x + (w - f.widthOfTextAtSize(s, sz)) / 2, yy, sz, f);
  const rightAt = (s: string, xr: number, yy: number, sz = size, f = font) =>
    text(s, xr - f.widthOfTextAtSize(s, sz), yy, sz, f);
  const box = (x: number, yBottom: number, w: number, h: number) =>
    page.drawRectangle({ x, y: yBottom, width: w, height: h, borderWidth: LINE, borderColor: BLACK });
  const hline = (yy: number, x1 = M, x2 = W - M) =>
    page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: LINE, color: BLACK });

  const co = mergeDocCompany(inv.company);
  const dateText = inv.date.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" });

  const pageHeader = (first: boolean) => {
    if (!first) {
      text(`${inv.number} · ${inv.customer}`, M, H - M - 8, 9, bold);
      y = H - M - 24;
    } else {
      page.drawImage(logo, { x: M, y: H - M - 58, width: 58, height: 58 });
      const tx = M + 68;
      text(co.name, tx, H - M - 14, 11, bold);
      text(co.address, tx, H - M - 29, 8);
      text(co.tel, tx, H - M - 41, 8.5);
      text(`Email: ${co.email}  ${co.web}`, tx, H - M - 53, 8.5);

      const bx = 388;
      const bw = W - M - bx;
      box(bx, H - M - 22, bw, 22);
      centered(docHead("ใบกำกับภาษี", "TAX INVOICE", inv.variant).th, bx, bw, H - M - 15, 11, bold);
      box(bx, H - M - 44, bw, 22);
      centered(docHead("ใบกำกับภาษี", "TAX INVOICE", inv.variant).en, bx, bw, H - M - 37, 11, bold);
      box(bx, H - M - 64, bw, 20);
      centered(`เลขประจำตัวผู้เสียภาษีอากร: ${co.taxId}`, bx, bw, H - M - 58, 8);

      y = H - M - 82;
      const rx = 388;
      const left = [
        `รหัสลูกค้า / Customer Code: ${inv.customerCode ?? ""}`,
        `ชื่อลูกค้า / Customer: ${inv.customer}`,
      ];
      left.forEach((l, i) => text(fit(l, font, size, rx - M - 8), M, y - i * 14));
      const addr = wrap(`ที่อยู่ / Address: ${inv.address ?? ""}`, font, size, rx - M - 8);
      addr.slice(0, 3).forEach((l, i) => text(l, M, y - (2 + i) * 14));
      const taxLine = [inv.taxId && `เลขประจำตัวผู้เสียภาษี: ${inv.taxId}`, inv.branch && `สาขา: ${inv.branch}`]
        .filter(Boolean)
        .join("   ");
      if (taxLine) text(fit(taxLine, font, size, rx - M - 8), M, y - 5 * 14);

      text(`เลขที่ / No.: ${inv.number}`, rx, y);
      text(`วันที่ / Date: ${dateText}`, rx, y - 14);
      text(fit(`พนักงานขาย / Sales: ${inv.salesperson ?? ""}`, font, size, W - M - rx), rx, y - 28);
      y -= 6 * 14 + 2;
    }

    tableTop = y;
    page.drawRectangle({ x: M, y: y - HEAD_H, width: tableW, height: HEAD_H, color: rgb(0.93, 0.94, 0.99) });
    const heads: [string, string][] = [
      ["ลำดับที่", "Item"],
      ["ยี่ห้อ", "Brand"],
      ["รุ่น", "Model"],
      ["รายละเอียด", "Description"],
      ["จำนวน", "Quantity"],
      ["ราคาต่อหน่วย", "Unit Price"],
      ["จำนวนเงิน", "Amount"],
    ];
    heads.forEach(([th, en], i) => {
      centered(th, xs[i], widths[i], y - 11, 8, bold);
      centered(en, xs[i], widths[i], y - 22, 8, bold);
    });
    y -= HEAD_H;
  };

  const closeTable = (bottom: number) => {
    hline(tableTop);
    hline(tableTop - HEAD_H);
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

  inv.lines.forEach((l, i) => {
    const nameRows = wrap(l.name, font, 14, widths[3] - 8);
    const modelRows = wrap(l.model, font, 14, widths[2] - 8);
    const brandRows = wrap(l.brand, font, 14, widths[1] - 8);
    const rows = Math.max(nameRows.length, modelRows.length, brandRows.length);
    const rowH = rows * 15 + 10;
    if (y - rowH < M + 8) {
      closeTable(y);
      newPage(false);
    }
    const top = y - 14;
    centered(String(i + 1), xs[0], widths[0], top, 14);
    brandRows.forEach((r, k) => text(r, xs[1] + 4, top - k * 15, 14));
    modelRows.forEach((r, k) => text(r, xs[2] + 4, top - k * 15, 14));
    nameRows.forEach((r, k) => text(r, xs[3] + 4, top - k * 15, 14));
    centered(`${l.qty} ${unitLabel(l.unit)}`, xs[4], widths[4], top, 14);
    rightAt(money(l.price), xs[5] + widths[5] - 4, top, 14);
    rightAt(money(l.qty * l.price), xs[7] - 4, top, 14);
    y -= rowH;
  });

  // The footer needs its full height; otherwise it goes on a fresh page.
  if (y - M < FOOT + 20) {
    closeTable(y);
    newPage(false);
  }
  const fy = M + FOOT;
  closeTable(fy);

  const { subtotal, vatAmount, total } = invoiceTotals(inv.lines, inv.vat);
  const totalsX = 360;
  const rowH = 16;
  const rows: [string, string, boolean][] = [
    ["ราคาสินค้า (TOTAL):", money(subtotal), false],
    ["ภาษีมูลค่าเพิ่ม 7% (VAT):", inv.vat ? money(vatAmount) : "-", false],
    ["ทั้งสิ้น (GRAND TOTAL):", money(total), true],
  ];
  rows.forEach(([label, value, strong], i) => {
    const by = fy - (i + 1) * rowH;
    box(totalsX, by, W - M - totalsX, rowH);
    text(label, totalsX + 5, by + 4.5, size, strong ? bold : font);
    rightAt(value, W - M - 5, by + 4.5, size, strong ? bold : font);
  });

  const noteTop = fy - 3 * rowH;
  const noteH = 38;
  box(M, noteTop - noteH, tableW, noteH);
  [
    "สินค้าและบริการนี้เป็นกรรมสิทธิ์ของบริษัท เอ็กซ์เพิร์ท อีเล็คโทรนิค แอนด์ คอมมูนิเคชั่น จำกัด จนกว่าผู้ซื้อจะชำระเงินครบตามจำนวน",
    "เมื่อท่านชำระเงินเรียบร้อยแล้ว ทางบริษัทจะออกใบเสร็จรับเงินให้",
    "(The receipt will be issued upon cash received or cheque cleared.)",
  ].forEach((l, i) => centered(l, M, tableW, noteTop - 11 - i * 11, 8));

  const payTop = noteTop - noteH;
  const payH = 22;
  box(M, payTop - payH, tableW, payH);
  text("ชำระโดย / PAID BY:", M + 5, payTop - 15, 9, bold);
  text(co.bank, M + 118, payTop - 15, 9, bold);

  const sigH = payTop - payH - M;
  const labels: [string, string][] = [
    ["ผู้รับสินค้า", "RECEIVED BY"],
    ["ผู้ส่งสินค้า", "DELIVERED BY"],
    ["ผู้รับเงิน", "COLLECTED BY"],
    ["ผู้มีอำนาจลงนาม", "AUTHORIZED SIGNATURE"],
  ];
  const sw = tableW / 4;
  labels.forEach(([th, en], i) => {
    const sx = M + i * sw;
    box(sx, M, sw, sigH);
    centered(th, sx, sw, M + 17, 8.5, bold);
    centered(en, sx, sw, M + 6, 7.5, bold);
  });

  return doc.save();
}
