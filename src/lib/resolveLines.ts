import type { SupabaseClient } from "@supabase/supabase-js";

export type RawLine = { product_id?: string | null; brand?: string; model?: string; name?: string; unit?: string; qty: number; price: number };
export type ResolvedLine = { product_id: string; brand: string; model: string; name: string; unit: string; qty: number; price: number };

const esc = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// Turns typed lines into product-linked lines. Typed items that are not in the database yet are created as new products.
export async function resolveLines(
  supabase: SupabaseClient,
  raw: RawLine[],
  draft: boolean,
): Promise<{ lines: ResolvedLine[] } | { error: "invalid" | "failed" }> {
  const made = new Map<string, { id: string; name: string; model: string | null; brand: string | null; unit: string }>();
  const out = new Map<string, ResolvedLine>();

  for (const l of raw) {
    const qty = draft ? Math.max(1, Math.floor(Number(l.qty)) || 1) : Math.floor(Number(l.qty));
    const price = draft ? Math.max(0, Number(l.price) || 0) : Number(l.price);
    const name = (l.name ?? "").trim();
    const model = (l.model ?? "").trim();
    const brand = (l.brand ?? "").trim();
    if (!l.product_id && !name && !model && !brand) continue;
    if (!name || !(qty > 0) || !(price >= 0)) return { error: "invalid" };

    let p: { id: string; name: string; model: string | null; brand: string | null; unit: string } | null = null;
    if (l.product_id) {
      const { data } = await supabase.from("products").select("id, name, model, brand, unit").eq("id", l.product_id).maybeSingle();
      p = data;
      if (!p) return { error: "invalid" };
    } else {
      const cacheKey = `${brand}|${model}|${name}`.toLowerCase();
      p = made.get(cacheKey) ?? null;
      if (!p && model) {
        const { data } = await supabase.from("products").select("id, name, model, brand, unit").ilike("model", esc(model)).limit(1);
        p = data?.[0] ?? null;
      }
      if (!p) {
        const { data } = await supabase.from("products").select("id, name, model, brand, unit").ilike("name", esc(name)).limit(20);
        p = data?.find((x) => (x.brand ?? "").trim().toLowerCase() === brand.toLowerCase()) ?? null;
      }
      if (!p) {
        const { data, error } = await supabase
          .from("products")
          .insert({ name, model: model || null, brand: brand || null, unit: (l.unit ?? "").trim() || "pcs" })
          .select("id, name, model, brand, unit")
          .single();
        if (error || !data) return { error: "failed" };
        p = data;
      }
      made.set(cacheKey, p);
    }
    const cur = out.get(p.id);
    out.set(p.id, {
      product_id: p.id,
      brand: p.brand ?? "",
      model: p.model ?? "",
      name: p.name,
      unit: p.unit,
      qty: (cur?.qty ?? 0) + qty,
      price,
    });
  }
  return { lines: [...out.values()] };
}
