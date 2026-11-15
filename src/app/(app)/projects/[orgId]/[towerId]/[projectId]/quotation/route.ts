import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/role";
import { buildQuotation, type QuoteLine } from "@/lib/quotation";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string; towerId: string; projectId: string }> },
) {
  const { towerId, projectId } = await params;
  const role = await getRole();
  if (role !== "admin" && role !== "manager") return new Response("forbidden", { status: 403 });
  const vat = new URL(req.url).searchParams.get("vat") === "1";

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("name, towers(name, organizations(name))")
    .eq("id", projectId)
    .eq("tower_id", towerId)
    .maybeSingle();
  if (!project) return new Response("not found", { status: 404 });
  const tower = project.towers as unknown as { name: string; organizations: { name: string } };

  const [{ data: plan }, { data: moves }, { data: prices }] = await Promise.all([
    supabase.from("project_items").select("product_id, planned_qty, products(name, unit)").eq("project_id", projectId),
    supabase.from("stock_movements").select("product_id, quantity, products(name, unit)").eq("project_id", projectId),
    supabase.from("product_prices").select("product_id, sell_price"),
  ]);
  const price = new Map((prices ?? []).map((p) => [p.product_id, Number(p.sell_price ?? 0)]));

  // Quote the planned list; if none exists, quote what the project has used.
  const items = new Map<string, QuoteLine>();
  if (plan?.length) {
    plan.forEach((i) => {
      const p = i.products as unknown as { name: string; unit: string };
      items.set(i.product_id, { name: p.name, unit: p.unit, qty: i.planned_qty, price: price.get(i.product_id) ?? 0 });
    });
  } else {
    (moves ?? []).forEach((m) => {
      const p = m.products as unknown as { name: string; unit: string };
      const cur = items.get(m.product_id) ?? { name: p.name, unit: p.unit, qty: 0, price: price.get(m.product_id) ?? 0 };
      cur.qty -= m.quantity;
      items.set(m.product_id, cur);
    });
  }
  const lines = [...items.values()].filter((l) => l.qty > 0);

  const pdf = await buildQuotation({
    customer: `${tower.organizations.name} · ${tower.name}`,
    project: project.name,
    lines,
    vat,
    date: new Date(),
  });
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="quotation.pdf"`,
    },
  });
}
