"use server";

import { revalidatePath } from "next/cache";
import readXlsxFile from "read-excel-file/node";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/role";

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

export async function listSheets(): Promise<string[]> {
  await guard();
  const res = await fetch(`https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`, { cache: "no-store" });
  if (!res.ok) throw new Error("github");
  const json = (await res.json()) as { tree: { path: string }[] };
  return json.tree.map((n) => n.path).filter((p) => p.startsWith(`${BASE}/`) && p.endsWith(".xlsx") && !p.slice(BASE.length + 1).includes("/"));
}

const cell = (v: unknown) => (v == null ? "" : String(v).trim());

// "BOSE AM40.png" -> "AM40"
const modelFromFile = (file: string, brand: string) => {
  const base = file.replace(/\.[^.]+$/, "").trim();
  const b = brand.toLowerCase();
  return base.toLowerCase().startsWith(`${b} `) ? base.slice(brand.length + 1).trim() : base;
};

export type SheetResult = { items: ImportItem[]; created: number; updated: number; warnings: string[]; error?: string };

export async function importSheet(path: string): Promise<SheetResult> {
  await guard();
  const out: SheetResult = { items: [], created: 0, updated: 0, warnings: [] };
  try {
    const res = await fetch(raw(path), { cache: "no-store" });
    if (!res.ok) throw new Error(`download ${res.status}`);
    const sheets = await readXlsxFile(Buffer.from(await res.arrayBuffer()));
    const rows = sheets[0].data.slice(1);

    const supabase = await createClient();
    const wanted = rows
      .map((r) => ({
        name: cell(r[0]),
        brand: cell(r[1]),
        main: cell(r[2]),
        sub: cell(r[3]),
        description: cell(r[4]),
        image: cell(r[6]),
        datasheet: cell(r[7]),
      }))
      .filter((r) => r.name && r.brand);
    const brands = [...new Set(wanted.map((w) => w.brand))];
    const { data: existing } = await supabase.from("products").select("id, name, model, brand").in("brand", brands).limit(5000);
    const pool = [...(existing ?? [])];

    for (const w of wanted) {
      const model = modelFromFile(w.image || w.datasheet, w.brand);
      const hit = pool.find(
        (p) =>
          p.brand?.toLowerCase() === w.brand.toLowerCase() &&
          ((model && (p.model ?? "").toLowerCase() === model.toLowerCase()) || p.name.toLowerCase() === w.name.toLowerCase()),
      );
      const fields = { category: w.main || null, sub_category: w.sub || null, description: w.description || null };
      let id = hit?.id;
      if (hit) {
        const patch = { ...fields, ...(model && !hit.model ? { model } : {}) };
        let { error } = await supabase.from("products").update(patch).eq("id", hit.id);
        if (error && "model" in patch) {
          out.warnings.push(`${w.name}: model "${model}" already used`);
          ({ error } = await supabase.from("products").update(fields).eq("id", hit.id));
        }
        if (error) {
          out.warnings.push(`${w.name}: ${error.message}`);
          continue;
        }
        out.updated++;
      } else {
        const row = { name: w.name, brand: w.brand, unit: "ชิ้น", ...fields };
        let { data, error } = await supabase.from("products").insert({ ...row, model: model || null }).select("id").single();
        if (error && model) {
          out.warnings.push(`${w.name}: model "${model}" already used`);
          ({ data, error } = await supabase.from("products").insert(row).select("id").single());
        }
        if (error || !data) {
          out.warnings.push(`${w.name}: ${error?.message ?? "insert failed"}`);
          continue;
        }
        id = data.id;
        pool.push({ id, name: w.name, model: model || null, brand: w.brand });
        out.created++;
      }
      out.items.push({ id: id!, brand: w.brand, name: w.name, image: w.image, datasheet: w.datasheet });
    }
    revalidatePath("/products", "layout");
  } catch (e) {
    out.error = e instanceof Error ? e.message : "error";
  }
  return out;
}

const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, "_");
const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", pdf: "application/pdf" };

async function download(kind: "images" | "datasheets", brand: string, file: string) {
  const res = await fetch(raw(`${BASE}/${kind}/${brand}/${file}`), { cache: "no-store" });
  return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
}

// Copies one product's image and datasheet from the repo into storage; existing ones are skipped.
export async function importAssets(item: ImportItem): Promise<{ image: "added" | "skipped" | "missing"; datasheet: "added" | "skipped" | "missing" }> {
  await guard();
  const supabase = await createClient();
  const out = { image: "missing", datasheet: "missing" } as { image: "added" | "skipped" | "missing"; datasheet: "added" | "skipped" | "missing" };
  const ext = (f: string) => f.split(".").pop()?.toLowerCase() ?? "";

  if (item.image) {
    const { data: p } = await supabase.from("products").select("image_path").eq("id", item.id).single();
    if (p?.image_path) out.image = "skipped";
    else {
      const buf = await download("images", item.brand, item.image);
      if (buf) {
        const path = `images/products/${item.id}/${Date.now()}-${safe(item.image)}`;
        const up = await supabase.storage.from("files").upload(path, buf, { contentType: MIME[ext(item.image)] ?? "application/octet-stream" });
        if (!up.error) {
          await supabase.from("products").update({ image_path: path }).eq("id", item.id);
          out.image = "added";
        }
      }
    }
  }
  if (item.datasheet) {
    const { data: f } = await supabase.from("product_files").select("id").eq("product_id", item.id).eq("file_name", item.datasheet).limit(1);
    if (f?.length) out.datasheet = "skipped";
    else {
      const buf = await download("datasheets", item.brand, item.datasheet);
      if (buf) {
        const path = `products/${item.id}/${Date.now()}-${safe(item.datasheet)}`;
        const up = await supabase.storage.from("files").upload(path, buf, { contentType: MIME[ext(item.datasheet)] ?? "application/octet-stream" });
        if (!up.error) {
          await supabase.from("product_files").insert({ product_id: item.id, storage_path: path, file_name: item.datasheet, size_bytes: buf.length });
          out.datasheet = "added";
        }
      }
    }
  }
  return out;
}
