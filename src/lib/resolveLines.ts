import type { SupabaseClient } from "@supabase/supabase-js";

export type RawLine = { product_id?: string | null; brand?: string; model?: string; name?: string; unit?: string; qty: number; price: number };
export type ResolvedLine = { product_id: string | null; brand: string; model: string; name: string; unit: string; qty: number; price: number };

// Turns typed lines into product-linked lines. A typed description that differs from a matched product replaces the saved one. Typed items that are not in the database are saved as new products only when brand, model and description are all filled; otherwise they stay as free-text lines (product_id null).
const esc = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function resolveLines(
  supabase: SupabaseClient,
  raw: RawLine[],
  draft: boolean,
): Promise<{ lines: ResolvedLine[] } | { error: "invalid" | "failed" }> {
  const out = new Map<string, ResolvedLine>();
  let free = 0;

  for (const l of raw) {
    const qty = draft ? Math.max(1, Math.floor(Number(l.qty)) || 1) : Math.floor(Number(l.qty));
    const price = draft ? Math.max(0, Number(l.price) || 0) : Number(l.price);
    const name = (l.name ?? "").trim();
    const model = (l.model ?? "").trim();
    const brand = (l.brand ?? "").trim();
    if (!l.product_id && !name && !model && !brand) continue;
    if (!name || !(qty > 0) || !(price >= 0)) return { error: "invalid" };

    if (!l.product_id && brand && model && name) {
      const { data: hit } = await supabase.from("products").select("id, name, model, brand, unit").ilike("model", esc(model)).limit(20);
      let p = hit?.find((x) => (x.brand ?? "").trim().toLowerCase() === brand.toLowerCase()) ?? null;
      if (!p) {
        const { data } = await supabase
          .from("products")
          .insert({ name, model, brand, unit: (l.unit ?? "").trim() || "ชิ้น" })
          .select("id, name, model, brand, unit")
          .single();
        if (!data) return { error: "failed" };
        p = data;
      }
      if (p.name !== name) await supabase.from("products").update({ name }).eq("id", p.id);
      const cur = out.get(p.id);
      out.set(p.id, { product_id: p.id, brand: p.brand ?? "", model: p.model ?? "", name, unit: p.unit, qty: (cur?.qty ?? 0) + qty, price });
      continue;
    }
    if (!l.product_id) {
      out.set(`free${free++}`, { product_id: null, brand, model, name, unit: (l.unit ?? "").trim() || "ชิ้น", qty, price });
      continue;
    }
    const { data: p } = await supabase.from("products").select("id, name, model, brand, unit").eq("id", l.product_id).maybeSingle();
    if (!p) return { error: "invalid" };
    // The typed description wins and replaces the saved one.
    if (p.name !== name) await supabase.from("products").update({ name }).eq("id", p.id);
    const cur = out.get(p.id);
    out.set(p.id, {
      product_id: p.id,
      brand: p.brand ?? "",
      model: p.model ?? "",
      name,
      unit: p.unit,
      qty: (cur?.qty ?? 0) + qty,
      price,
    });
  }
  return { lines: [...out.values()] };
}
