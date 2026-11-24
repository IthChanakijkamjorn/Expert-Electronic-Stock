"use server";

import { revalidatePath } from "next/cache";
import readXlsxFile from "read-excel-file/node";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/role";
import { fileNameOf, syncQuietly, type SpecTab } from "@/lib/website";
import { logAudit } from "@/lib/audit";

const REPO = "IthChanakijkamjorn/studio";
const BRANCH = "main";
const BASE = "import";

const raw = (path: string) =>
  `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${path.split("/").map(encodeURIComponent).join("/")}`;

async function guard() {
  const role = await getRole();
  if (role !== "admin" && role !== "manager") throw new Error("forbidden");
}

export type ImportItem = { id: string; brand: string; name: string; image: string; datasheet: string };

// Files starting with "_" (e.g. _TEMPLATE_products.xlsx) are not imported.
export async function listSheets(): Promise<string[]> {
  await guard();
  const res = await fetch(`https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`, { cache: "no-store" });
  if (!res.ok) throw new Error("github");
  const json = (await res.json()) as { tree: { path: string }[] };
  return json.tree
    .map((n) => n.path)
    .filter((p) => {
      const file = p.slice(BASE.length + 1);
      return p.startsWith(`${BASE}/`) && p.endsWith(".xlsx") && !file.includes("/") && !file.startsWith("_");
    });
}

const cell = (v: unknown) => (v == null ? "" : String(v).trim());
const key = (h: unknown) => cell(h).toLowerCase().replace(/[^a-z0-9]/g, "");

// Blank -> undefined, so "not filled in" can be told apart from "no".
const yesNo = (v: unknown): boolean | undefined => {
  if (typeof v === "boolean") return v;
  const s = cell(v).toLowerCase();
  if (!s) return undefined;
  return ["true", "yes", "y", "1", "x", "✓"].includes(s);
};

const count = (v: unknown) => {
  const n = Math.floor(Number(cell(v)));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// Reads a sheet by its header row; column order and spelling ("Main-Category", "main category") do not matter.
function table(data: unknown[][] | undefined) {
  if (!data?.length) return null;
  const cols = data[0].map(key);
  return data.slice(1).map((r) => (k: string) => {
    const i = cols.indexOf(k);
    return i < 0 ? undefined : r[i];
  });
}

// "BOSE AM40.png" -> "AM40"
const modelFromFile = (file: string, brand: string) => {
  const base = file.replace(/\.[^.]+$/, "").trim();
  const b = brand.toLowerCase();
  return base.toLowerCase().startsWith(`${b} `) ? base.slice(brand.length + 1).trim() : base;
};

export type SheetResult = { items: ImportItem[]; created: number; updated: number; warnings: string[]; error?: string };

export async function importSheet(path: string): Promise<SheetResult> {
  await guard();
  const res = await fetch(raw(path), { cache: "no-store" });
  if (!res.ok) return { items: [], created: 0, updated: 0, warnings: [], error: `download ${res.status}` };
  return importWorkbook(Buffer.from(await res.arrayBuffer()));
}

// An .xlsx picked on the Import page (e.g. an edited export). Photos and datasheets named in it
// are still taken from studio/import; products that already have them keep theirs.
export async function importUpload(form: FormData): Promise<SheetResult> {
  await guard();
  const file = form.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx"))
    return { items: [], created: 0, updated: 0, warnings: [], error: "not an .xlsx file" };
  return importWorkbook(Buffer.from(await file.arrayBuffer()));
}

async function importWorkbook(buf: Buffer): Promise<SheetResult> {
  const out: SheetResult = { items: [], created: 0, updated: 0, warnings: [] };
  try {
    const sheets = await readXlsxFile(buf);
    const byName = (n: string) => sheets.find((s) => key(s.sheet) === key(n))?.data;
    const productData = byName("Products") ?? sheets[0].data;
    const products = table(productData);
    if (!products) throw new Error("no Products sheet");
    const hasCol = (k: string) => productData[0].map(key).includes(k);
    const glance = table(byName("At-a-glance"));
    const specs = table(byName("Specifications"));

    // ProductName in these sheets is the product's Name, or its Model when Name is empty.
    const forProduct = (keys: string[]) => (row: (k: string) => unknown) => keys.includes(cell(row("productname")).toLowerCase());
    const glanceOf = (keys: string[]) => glance!.filter(forProduct(keys)).map((r) => cell(r("bullets"))).filter(Boolean);
    const specsOf = (keys: string[]) => {
      const tabs: SpecTab[] = [];
      for (const r of specs!.filter(forProduct(keys))) {
        const label = cell(r("label"));
        const value = cell(r("value"));
        if (!label || !value) continue;
        const tabName = cell(r("tabname"));
        let tab = tabs.find((t) => t.tabName === tabName);
        if (!tab) tabs.push((tab = { tabName, rows: [] }));
        tab.rows.push({ label, value });
      }
      return tabs;
    };

    // Brand and Model are required. Old brand files have no Model column, so there the model is taken from the image file name.
    const legacy = !hasCol("model");
    const wanted = [];
    for (const [i, r] of products.entries()) {
      const row = {
        name: cell(r("name")),
        brand: cell(r("brand")),
        model: cell(r("model")),
        main: cell(r("maincategory") ?? r("category")),
        sub: cell(r("subcategory")),
        description: cell(r("description")),
        image: cell(r("image")),
        datasheet: cell(r("datasheet")),
        website: yesNo(r("website")),
        unit: cell(r("unit")),
        quantity: count(r("quantity")),
      };
      if (!row.brand && !row.model && !row.name) continue;
      if (legacy && row.brand) row.model = modelFromFile(row.image || row.datasheet, row.brand);
      if (!row.brand || !row.model) out.warnings.push(`row ${i + 2}: Brand and Model are required`);
      else wanted.push(row);
    }

    const supabase = await createClient();
    const brands = [...new Set(wanted.map((w) => w.brand))];
    const { data: existing } = await supabase.from("products").select("id, name, model, brand").in("brand", brands).limit(5000);
    const pool = [...(existing ?? [])];
    const lc = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
    // Names match ignoring punctuation and spacing, so fixing "Flood Light/" to "Flood Light" still finds the product.
    const nameKey = (v: string | null | undefined) => lc(v).replace(/[^\p{L}\p{M}\p{N}]+/gu, "");

    for (const w of wanted) {
      const { model } = w;
      const label = w.name || `${w.brand} ${model}`;
      const sameBrand = pool.filter((p) => lc(p.brand) === lc(w.brand));
      const hit =
        sameBrand.find((p) => lc(p.model) === lc(model)) ??
        (w.name ? sameBrand.find((p) => (legacy || !p.model) && nameKey(p.name) === nameKey(w.name)) : undefined);
      // Being in the file brings back a product that was removed earlier.
      const fields: Record<string, unknown> = {
        active: true,
        name: w.name || null,
        category: w.main || null,
        sub_category: w.sub || null,
        description: w.description || null,
        ...(w.unit && { unit: /^pcs?$/i.test(w.unit) ? "ชิ้น" : w.unit }),
      };
      // No rows for this product in those sheets means "keep what it has", so a partial file cannot wipe them.
      const keys = [w.name, model].filter(Boolean).map(lc);
      const bullets = glance ? glanceOf(keys) : [];
      const tabs = specs ? specsOf(keys) : [];
      if (bullets.length) fields.at_a_glance = bullets;
      if (tabs.length) fields.specifications = tabs;
      // An empty Website cell means "show it"; only an explicit no hides it.
      if (hasCol("website") || !hit) fields.on_website = w.website ?? true;

      let id = hit?.id;
      if (hit) {
        // A guessed model never overwrites one that is already set.
        const setModel = legacy ? !hit.model : hit.model !== model;
        let { error } = await supabase.from("products").update({ ...fields, ...(setModel ? { model } : {}) }).eq("id", hit.id);
        if (error && setModel) {
          out.warnings.push(`${label}: model "${model}" already used`);
          ({ error } = await supabase.from("products").update(fields).eq("id", hit.id));
        }
        if (error) {
          out.warnings.push(`${label}: ${error.message}`);
          continue;
        }
        if (setModel) hit.model = model;
        out.updated++;
      } else {
        const { data, error } = await supabase
          .from("products")
          .insert({ brand: w.brand, model, unit: "ชิ้น", ...fields })
          .select("id")
          .single();
        if (error || !data) {
          out.warnings.push(`${label}: ${error?.code === "23505" ? `model "${model}" already used` : error?.message ?? "insert failed"}`);
          continue;
        }
        id = data.id;
        pool.push({ id: data.id, name: w.name || null, model, brand: w.brand });
        out.created++;
        // Quantity only applies to new products; re-imports ignore it, stock changes go through movements.
        if (w.quantity) {
          const { error: e } = await supabase
            .from("stock_movements")
            .insert({ product_id: data.id, quantity: w.quantity, type: "count_correction", comment: "ยอดยกมา (นำเข้าจาก Excel)" });
          if (e) out.warnings.push(`${label}: quantity ${e.message}`);
        }
      }
      out.items.push({ id: id!, brand: w.brand, name: label, image: w.image, datasheet: w.datasheet });
    }
    revalidatePath("/products", "layout");
  } catch (e) {
    out.error = e instanceof Error ? e.message : "error";
  }
  return out;
}

const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, "_");
const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", pdf: "application/pdf" };
type AssetState = "added" | "skipped" | "missing";

async function download(kind: "images" | "datasheets", brand: string, file: string) {
  const res = await fetch(raw(`${BASE}/${kind}/${brand}/${file}`), { cache: "no-store" });
  return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
}

// Copies one product's image and datasheet from the repo into storage. The Excel file wins:
// a different image file name replaces the photo, and the named datasheet becomes the one shown on the website.
export async function importAssets(item: ImportItem): Promise<{ image: AssetState; datasheet: AssetState }> {
  await guard();
  const supabase = await createClient();
  const out: { image: AssetState; datasheet: AssetState } = { image: "missing", datasheet: "missing" };
  const ext = (f: string) => f.split(".").pop()?.toLowerCase() ?? "";

  if (item.image) {
    const { data: p } = await supabase.from("products").select("image_path").eq("id", item.id).single();
    if (p?.image_path && fileNameOf(p.image_path) === safe(item.image)) out.image = "skipped";
    else {
      const buf = await download("images", item.brand, item.image);
      if (buf) {
        const path = `images/products/${item.id}/${Date.now()}-${safe(item.image)}`;
        const up = await supabase.storage.from("files").upload(path, buf, { contentType: MIME[ext(item.image)] ?? "application/octet-stream" });
        if (!up.error) {
          await supabase.from("products").update({ image_path: path }).eq("id", item.id);
          if (p?.image_path) await supabase.storage.from("files").remove([p.image_path]);
          out.image = "added";
        }
      }
    }
  }
  if (item.datasheet) {
    const { data: f } = await supabase.from("product_files").select("id").eq("product_id", item.id).eq("file_name", item.datasheet).limit(1);
    let fileId: string | undefined = f?.[0]?.id;
    if (fileId) out.datasheet = "skipped";
    else {
      const buf = await download("datasheets", item.brand, item.datasheet);
      if (buf) {
        const path = `products/${item.id}/${Date.now()}-${safe(item.datasheet)}`;
        const up = await supabase.storage.from("files").upload(path, buf, { contentType: MIME[ext(item.datasheet)] ?? "application/octet-stream" });
        if (!up.error) {
          const { data: row } = await supabase
            .from("product_files")
            .insert({ product_id: item.id, storage_path: path, file_name: item.datasheet, size_bytes: buf.length })
            .select("id")
            .single();
          fileId = row?.id;
          out.datasheet = "added";
        }
      }
    }
    if (fileId) await supabase.from("products").update({ website_datasheet_id: fileId }).eq("id", item.id);
  }
  return out;
}

// "Remove products not in this file": active products whose id is not in keep. Admin only, like deleting one product.
export async function listMissing(keep: string[]): Promise<{ id: string; name: string; stock: number }[]> {
  if ((await getRole()) !== "admin") throw new Error("forbidden");
  const supabase = await createClient();
  const { data, error } = await supabase.from("product_stock").select("id, name:display_name, stock").eq("active", true).limit(10000);
  if (error) throw new Error(error.message);
  const k = new Set(keep);
  return (data ?? []).filter((p) => !k.has(p.id));
}

// Same as the product page's delete: hidden from the back office and the website, history (stock, projects, quotes) kept.
export async function removeProducts(ids: string[]): Promise<number> {
  if ((await getRole()) !== "admin") throw new Error("forbidden");
  const supabase = await createClient();
  let done = 0;
  for (const id of ids) {
    const { data } = await supabase.from("products").update({ active: false }).eq("id", id).select("display_name").maybeSingle();
    if (!data) continue;
    await logAudit("delete", "product", `${data.display_name} (Excel import)`);
    await syncQuietly(supabase, id);
    done++;
  }
  revalidatePath("/products", "layout");
  return done;
}
