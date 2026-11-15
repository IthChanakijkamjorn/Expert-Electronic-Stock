import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { fetchAll } from "@/lib/fetchAll";
import { InvoiceForm } from "./InvoiceForm";

export default async function NewInvoicePage() {
  const { t } = await getDictionary();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub ?? "";

  const [products, locStock, prices, { data: projects }, { data: locations }, { data: me }] = await Promise.all([
    fetchAll((a, b) =>
      supabase.from("product_stock").select("id, name, sku, brand, unit").eq("active", true).order("id").range(a, b),
    ),
    fetchAll((a, b) =>
      supabase.from("product_location_stock").select("product_id, location_id, qty").order("product_id").range(a, b),
    ),
    // Only managers can read prices; for staff this is empty and they type the price.
    fetchAll((a, b) => supabase.from("product_prices").select("product_id, sell_price").order("product_id").range(a, b)),
    supabase
      .from("projects")
      .select("id, name, year, towers(name, organizations(name))")
      .order("year", { ascending: false })
      .limit(500),
    supabase.from("locations").select("id, name, is_default").order("name"),
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
  ]);

  const stock: Record<string, Record<string, number>> = {};
  locStock.forEach((r) => ((stock[r.product_id] ??= {})[r.location_id] = r.qty));
  const sellPrice: Record<string, number> = {};
  prices.forEach((p) => {
    if (p.sell_price !== null) sellPrice[p.product_id] = Number(p.sell_price);
  });
  const projectOptions = (projects ?? []).map((p) => {
    const tw = p.towers as unknown as { name: string; organizations: { name: string } };
    return { id: p.id, label: `${tw.organizations.name} › ${tw.name} › ${p.year} › ${p.name}` };
  });

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">{t.newTaxInvoice}</h1>
      <InvoiceForm
        t={t}
        products={products}
        stock={stock}
        sellPrice={sellPrice}
        projects={projectOptions}
        locations={locations ?? []}
        salesperson={me?.full_name ?? ""}
      />
    </section>
  );
}
