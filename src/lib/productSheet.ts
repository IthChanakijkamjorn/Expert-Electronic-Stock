import ExcelJS from "exceljs";

// The one product Excel layout: the export writes it, the importer (products/import) reads it,
// and studio/import/_TEMPLATE_products.xlsx is generated from it. Keep all three in step.
export const PRODUCT_COLUMNS = [
  ["Brand", 12, "Required. Same spelling every time (e.g. BOSE). Image/datasheet files go in images/<Brand>/ and datasheets/<Brand>/."],
  ["Model", 16, "Recommended. Unique model code (e.g. AM40). Used to match the product on re-import, so do not change it later. If empty it is guessed from the image file name."],
  ["Name", 40, "Required. Product name shown on the website. Also the key for the At-a-glance and Specifications sheets."],
  ["Main-Category", 22, "Website menu, lowercase-with-dashes (e.g. pa-speaker)."],
  ["Sub-Category", 22, "Website sub-menu, lowercase-with-dashes (e.g. ceiling-speaker)."],
  ["Description", 50, "Shown on the website and in the back office."],
  ["Image", 22, "File name inside images/<Brand>/ (e.g. BOSE AM40.png). Use a new file name to replace the photo."],
  ["Datasheet", 22, "File name inside datasheets/<Brand>/ (e.g. BOSE AM40.pdf)."],
  ["Quantity", 10, "Stock on hand. Only used when the product is created the first time; after that change stock in รับ/จ่ายสินค้า (re-import ignores it)."],
  ["Unit", 8, "Default ชิ้น."],
  ["Website", 10, "TRUE or empty = show on website. FALSE = back office only (removes it from the website)."],
] as const;

export type ProductSheetRow = {
  brand: string | null;
  model: string | null;
  name: string;
  category: string | null;
  subCategory: string | null;
  description: string | null;
  image: string | null;
  datasheet: string | null;
  quantity: number | null;
  unit: string | null;
  website: boolean;
  atAGlance: string[] | null;
  specifications: { tabName: string; rows: { label: string; value: string }[] }[] | null;
};

function header(ws: ExcelJS.Worksheet) {
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2A5C" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

export async function productsXlsx(rows: ProductSheetRow[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Products");
  ws.columns = PRODUCT_COLUMNS.map(([h, width]) => ({ header: h, width }));
  for (const p of rows)
    ws.addRow([p.brand, p.model, p.name, p.category, p.subCategory, p.description, p.image, p.datasheet, p.quantity, p.unit, p.website ? "TRUE" : "FALSE"]);
  header(ws);
  const websiteCol = PRODUCT_COLUMNS.length;
  for (let r = 2; r <= rows.length + 500; r++)
    ws.getCell(r, websiteCol).dataValidation = { type: "list", allowBlank: true, formulae: ['"TRUE,FALSE"'] };

  const g = wb.addWorksheet("At-a-glance");
  g.columns = [{ header: "ProductName", width: 40 }, { header: "Bullets", width: 80 }];
  for (const p of rows) for (const b of p.atAGlance ?? []) g.addRow([p.name, b]);
  header(g);

  const s = wb.addWorksheet("Specifications");
  s.columns = [{ header: "ProductName", width: 40 }, { header: "tabName", width: 20 }, { header: "Label", width: 30 }, { header: "Value", width: 40 }];
  for (const p of rows) for (const tab of p.specifications ?? []) for (const r of tab.rows) s.addRow([p.name, tab.tabName, r.label, r.value]);
  header(s);

  const h = wb.addWorksheet("How to use");
  h.columns = [{ header: "Column (Products sheet)", width: 18 }, { header: "What to put", width: 120 }];
  PRODUCT_COLUMNS.forEach(([n, , d]) => h.addRow([n, d]));
  h.addRow([]);
  h.addRow(["Steps", "1) Save as <BRAND>_products.xlsx in studio/import/ (names starting with _ are skipped). 2) Put photos in import/images/<Brand>/ and PDFs in import/datasheets/<Brand>/. 3) Push to GitHub. 4) Back office → Products → Import → Start import. Stock app and website are both updated."]);
  h.addRow(["Re-import", "Safe to run again any time. Products are matched by Brand + Model (or Name), never duplicated. Unchanged products are not re-sent to the website. A product with no rows in At-a-glance / Specifications keeps its current ones."]);
  h.addRow(["Export", "Products → ดาวน์โหลด Excel gives this same layout with every product, so you can edit it and import it back."]);
  header(h);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
