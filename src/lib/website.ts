import { createHash } from "node:crypto";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;
export type SpecTab = { tabName: string; rows: { label: string; value: string }[] };
export type WebsiteResult = "published" | "unchanged" | "removed" | "skipped";

const PID = "q1vklck6";
const DATASET = "production";
const API = "v2024-01-01";
const BASE = `https://${PID}.api.sanity.io/${API}`;

function headers(contentType = "application/json") {
  const t = process.env.SANITY_WRITE_TOKEN;
  if (!t) throw new Error("SANITY_WRITE_TOKEN is not set");
  return { Authorization: `Bearer ${t}`, "Content-Type": contentType };
}

// Same rule as the old studio importer, so existing website URLs and document ids are kept.
export const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[\s_]+/g, "-").replace(/[^\w-]+/g, "").replace(/--+/g, "-");

async function mutate(mutations: unknown[]) {
  const res = await fetch(`${BASE}/data/mutate/${DATASET}`, { method: "POST", headers: headers(), body: JSON.stringify({ mutations }) });
  if (!res.ok) throw new Error(`sanity ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function getDoc(id: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${BASE}/data/doc/${DATASET}/${encodeURIComponent(id)}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`sanity ${res.status}`);
  const { documents } = (await res.json()) as { documents: Record<string, unknown>[] };
  return documents[0] ?? null;
}

async function uploadAsset(supabase: Supabase, kind: "images" | "files", path: string, fileName: string) {
  const { data, error } = await supabase.storage.from("files").download(path);
  if (error || !data) throw new Error(`download ${fileName}`);
  const res = await fetch(`${BASE}/assets/${kind}/${DATASET}?filename=${encodeURIComponent(fileName)}`, {
    method: "POST",
    headers: headers(data.type || "application/octet-stream"),
    body: Buffer.from(await data.arrayBuffer()),
  });
  if (!res.ok) throw new Error(`asset upload ${res.status}`);
  const { document } = (await res.json()) as { document: { _id: string } };
  return { _type: kind === "images" ? "image" : "file", asset: { _type: "reference", _ref: document._id } };
}

// Storage keys are "<timestamp>-<name>" (import) or "<uuid>.<ext>" (upload); this gives the name part.
export const fileNameOf = (path: string) => path.split("/").pop()!.replace(/^\d+-/, "");

/**
 * Pushes one product to the website, or removes it when it is not listed (or deactivated).
 * Fields that are null in the backoffice are left as they are on the website.
 */
export async function syncProductToWebsite(supabase: Supabase, productId: string): Promise<WebsiteResult> {
  const { data: p, error } = await supabase
    .from("products")
    .select("id, name, brand, category, sub_category, description, featured, at_a_glance, specifications, image_path, website_datasheet_id, on_website, active, sanity_id, website_synced")
    .eq("id", productId)
    .single();
  if (error || !p) throw new Error(error?.message ?? "not found");

  if (!p.on_website || !p.active) {
    if (!p.sanity_id || !p.website_synced) return "skipped";
    await mutate([{ delete: { id: p.sanity_id } }, { delete: { id: `drafts.${p.sanity_id}` } }]);
    await supabase.from("products").update({ website_synced: null }).eq("id", p.id);
    return "removed";
  }

  const sanityId = p.sanity_id ?? `product-${slugify(p.name)}`;
  if (!p.sanity_id) {
    const { error: e } = await supabase.from("products").update({ sanity_id: sanityId }).eq("id", p.id);
    if (e) throw new Error(e.code === "23505" ? `another product already uses website id ${sanityId}` : e.message);
  }

  const { data: sheet } = p.website_datasheet_id
    ? await supabase.from("product_files").select("storage_path, file_name").eq("id", p.website_datasheet_id).maybeSingle()
    : { data: null };

  const fields: Record<string, unknown> = { name: p.name };
  if (p.brand) fields.brand = p.brand;
  // The website routes use lowercase category slugs.
  if (p.category) fields.mainCategory = p.category.trim().toLowerCase();
  if (p.sub_category) fields.subCategory = p.sub_category.trim().toLowerCase();
  if (p.description != null) fields.description = p.description;
  if (p.featured != null) fields.featured = p.featured;
  if (p.at_a_glance != null) fields.atAGlance = p.at_a_glance;
  if (p.specifications != null)
    fields.specifications = (p.specifications as SpecTab[]).map((tab, i) => ({
      _type: "specTab",
      _key: `t${i}`,
      tabName: tab.tabName,
      rows: tab.rows.map((r, j) => ({ _type: "specRow", _key: `t${i}r${j}`, label: r.label, value: r.value })),
    }));

  const hash = createHash("sha1")
    .update(JSON.stringify([fields, p.image_path, sheet?.storage_path ?? null]))
    .digest("hex");
  const synced = (p.website_synced ?? {}) as { hash?: string; image?: string; datasheet?: string };
  const doc = await getDoc(sanityId);
  if (doc && synced.hash === hash) return "unchanged";

  if (p.image_path && (!doc?.image || synced.image !== p.image_path))
    fields.image = await uploadAsset(supabase, "images", p.image_path, fileNameOf(p.image_path));
  if (sheet && (!doc?.datasheet || synced.datasheet !== sheet.storage_path))
    fields.datasheet = await uploadAsset(supabase, "files", sheet.storage_path, sheet.file_name);

  // Only take files off the website that this app put there.
  const unset = [!p.image_path && synced.image && "image", !sheet && synced.datasheet && "datasheet"].filter(Boolean);
  await mutate([
    { createIfNotExists: { _id: sanityId, _type: "product", name: p.name, slug: { _type: "slug", current: slugify(p.name) } } },
    { patch: { id: sanityId, set: fields } },
    ...(unset.length ? [{ patch: { id: sanityId, unset } }] : []),
  ]);
  await supabase
    .from("products")
    .update({ website_synced: { hash, image: p.image_path, datasheet: sheet?.storage_path ?? null } })
    .eq("id", p.id);
  return "published";
}

// For edits made elsewhere in the app: keep the website in step without failing the edit itself.
export async function syncQuietly(supabase: Supabase, productId: string) {
  try {
    await syncProductToWebsite(supabase, productId);
  } catch (e) {
    console.error("website sync failed", productId, e);
  }
}
