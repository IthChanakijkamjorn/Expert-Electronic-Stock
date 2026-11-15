import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/role";
import type { QuoteLine } from "@/lib/quotation";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;
const num = (f: FormData, k: string) => {
  const v = text(f, k);
  return v === null || Number.isNaN(Number(v)) ? null : Math.max(0, Number(v));
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string; towerId: string; projectId: string }> },
) {
  const { towerId, projectId } = await params;
  const role = await getRole();
  if (role !== "admin" && role !== "manager") return new Response("forbidden", { status: 403 });
  const form = await req.formData();
  const customer = text(form, "customer");
  if (!customer) return new Response("customer required", { status: 400 });

  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("id").eq("id", projectId).eq("tower_id", towerId).maybeSingle();
  if (!project) return new Response("not found", { status: 404 });

  const sel = "product_id, products(name, unit, brand, sku)";
  const [{ data: plan }, { data: moves }, { data: prices }] = await Promise.all([
    supabase.from("project_items").select(`${sel}, planned_qty`).eq("project_id", projectId),
    supabase.from("stock_movements").select(`${sel}, quantity`).eq("project_id", projectId),
    supabase.from("product_prices").select("product_id, sell_price"),
  ]);
  const price = new Map((prices ?? []).map((p) => [p.product_id, Number(p.sell_price ?? 0)]));
  type P = { name: string; unit: string; brand: string | null; sku: string | null };
  const line = (id: string, p: P, qty: number): QuoteLine => ({
    brand: p.brand ?? "",
    model: p.sku ?? "",
    name: p.name,
    unit: p.unit,
    qty,
    price: price.get(id) ?? 0,
  });

  // Quote the planned list; if none exists, quote what the project has used.
  const items = new Map<string, QuoteLine>();
  if (plan?.length) {
    plan.forEach((i) => items.set(i.product_id, line(i.product_id, i.products as unknown as P, i.planned_qty)));
  } else {
    (moves ?? []).forEach((m) => {
      const cur = items.get(m.product_id) ?? line(m.product_id, m.products as unknown as P, 0);
      cur.qty -= m.quantity;
      items.set(m.product_id, cur);
    });
  }
  const lines = [...items.values()].filter((l) => l.qty > 0);
  if (!lines.length) return new Response("no items to quote", { status: 400 });

  const { data: created, error } = await supabase
    .from("quotations")
    .insert({
      project_id: projectId,
      customer,
      attention: text(form, "attention"),
      phone: text(form, "phone"),
      email: text(form, "email"),
      valid_days: num(form, "valid_days"),
      lead_days: num(form, "lead_days"),
      warranty_years: num(form, "warranty_years"),
      payment_terms: text(form, "payment_terms"),
      discount_pct: Math.min(100, num(form, "discount_pct") ?? 0),
      vat: form.get("vat") === "1",
      quoted_by: text(form, "quoted_by"),
      lines,
    })
    .select("id")
    .single();
  if (error || !created) return new Response("could not save quotation", { status: 500 });

  const url = new URL(`${created.id}`, req.url.replace(/\/?$/, "/"));
  return Response.redirect(url, 303);
}
