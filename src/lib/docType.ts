export type DocVariant = "original" | "copy";

export const parseVariant = (v: string | null | undefined): DocVariant => (v === "copy" ? "copy" : "original");

// "ต้นฉบับใบกำกับภาษี / ORIGINAL TAX INVOICE" or "สำเนาใบกำกับภาษี / COPY OF TAX INVOICE".
export const docHead = (th: string, en: string, v: DocVariant = "original") =>
  v === "copy" ? { th: `สำเนา${th}`, en: `COPY OF ${en}` } : { th: `ต้นฉบับ${th}`, en: `ORIGINAL ${en}` };
