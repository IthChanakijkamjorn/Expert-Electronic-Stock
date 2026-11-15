"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/role";

export type QuotationState = { error?: "invalid" | "failed" } | null;

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;
const num = (f: FormData, k: string) => {
  const v = text(f, k);
  return v === null || Number.isNaN(Number(v)) ? null : Math.max(0, Number(v));
};

export async function saveQuotation(id: string | null, _prev: QuotationState, formData: FormData): Promise<QuotationState> {
  const role = await getRole();
  if (role !== "admin" && role !== "manager") return { error: "failed" };
  const draft = formData.get("intent") === "draft";
  const customer = text(formData, "customer") ?? (draft ? "-" : null);
  let raw: { product_id: string; qty: number; price: number }[] = [];
  let company: unknown = null;
  try {
    raw = JSON.parse(String(formData.get("lines") ?? "[]"));
    company = JSON.parse(String(formData.get("company") ?? "null"));
  } catch {
    return { error: "invalid" };
  }
  if (!customer || !Array.isArray(raw) || (!draft && !raw.length)) return { error: "invalid" };

  const wanted = new Map<string, { qty: number; price: number }>();
  for (const l of raw) {
    const qty = draft ? Math.max(1, Math.floor(Number(l.qty)) || 1) : Math.floor(Number(l.qty));
    const price = draft ? Math.max(0, Number(l.price) || 0) : Number(l.price);
    if (!l.product_id || !(qty > 0) || !(price >= 0)) return { error: "invalid" };
    wanted.set(l.product_id, { qty: (wanted.get(l.product_id)?.qty ?? 0) + qty, price });
  }

  const supabase = await createClient();
  const { data: products } = wanted.size
    ? await supabase.from("products").select("id, name, sku, brand, unit").in("id", [...wanted.keys()])
    : { data: [] };
  if (!products || products.length !== wanted.size) return { error: "invalid" };
  const order = raw.map((l) => l.product_id);
  const lines = [...new Set(order)].map((id) => {
    const p = products.find((x) => x.id === id)!;
    const w = wanted.get(id)!;
    return { product_id: id, brand: p.brand ?? "", model: p.sku ?? "", name: p.name, unit: p.unit, qty: w.qty, price: w.price };
  });

  const payload = {
      project_id: text(formData, "project_id"),
      project_label: text(formData, "project_label"),
      quote_date: text(formData, "quote_date") ?? undefined,
      customer,
      attention: text(formData, "attention"),
      phone: text(formData, "phone"),
      email: text(formData, "email"),
      valid_days: num(formData, "valid_days"),
      lead_days: num(formData, "lead_days"),
      warranty_years: num(formData, "warranty_years"),
      payment_terms: text(formData, "payment_terms"),
      discount_pct: Math.min(100, num(formData, "discount_pct") ?? 0),
      vat: formData.get("vat") === "1",
      quoted_by: text(formData, "quoted_by"),
      signature_id: text(formData, "signature_id"),
      company,
      lines,
      status: draft ? "draft" : "final",
      updated_at: new Date().toISOString(),
    };
  const { data: created, error } = id
    ? await supabase.from("quotations").update(payload).eq("id", id).select("id").single()
    : await supabase.from("quotations").insert(payload).select("id").single();
  if (error || !created) return { error: "failed" };
  revalidatePath("/quotations");
  revalidatePath("/documents");
  redirect(`/quotations/${created.id}?created=1`);
}
