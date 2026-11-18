import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { fetchAll } from "@/lib/fetchAll";
import { InvoiceForm } from "./new/InvoiceForm";
import { mergeDocCompany } from "@/lib/company";
import { loadCompanyDefault } from "@/lib/companyDefaults";
import { notFound } from "next/navigation";
import type { PaperData } from "@/components/InvoicePaper";

export async function InvoiceEditor({ id }: { id?: string }) {
  const { t } = await getDictionary();
  const supabase = await createClient();

  const [products, stockRows, prices, { data: projects }, { data: salespeople }] = await Promise.all([
    fetchAll((a, b) =>
      supabase.from("product_stock").select("id, name, model, brand, unit").eq("active", true).order("id").range(a, b),
    ),
    fetchAll((a, b) =>
      supabase.from("product_stock").select("id, stock").eq("active", true).order("id").range(a, b),
    ),
    // Only managers can read prices; for staff this is empty and they type the price.
    fetchAll((a, b) => supabase.from("product_prices").select("product_id, sell_price").order("product_id").range(a, b)),
    supabase
      .from("projects")
      .select("id, name, year, towers(name, organizations(name))")
      .order("year", { ascending: false })
      .limit(500),
    supabase.from("salespeople").select("id, name").order("name"),
  ]);

  const stock: Record<string, number> = {};
  stockRows.forEach((r) => (stock[r.id] = r.stock));
  let existing: React.ComponentProps<typeof InvoiceForm>["existing"];
  if (id) {
    const { data: inv } = await supabase.from("tax_invoices").select("*").eq("id", id).maybeSingle();
    if (!inv) notFound();
    const lines = (inv.lines as { product_id: string | null; brand: string | null; model: string | null; name: string; unit: string; qty: number; price: number }[]).map((l, i) => ({
      key: l.product_id ?? `free${i}`,
      productId: l.product_id ?? undefined,
      brand: l.brand,
      model: l.model,
      name: l.name,
      unit: l.unit,
      qty: String(l.qty),
      price: String(l.price),
    }));
    const data = {
      number: inv.number ?? "DRAFT",
      company: mergeDocCompany(inv.company),
      customerCode: inv.customer_code ?? "",
      customer: inv.customer === "-" && inv.status === "draft" ? "" : inv.customer,
      address: inv.address ?? "",
      taxId: inv.tax_id ?? "",
      branch: inv.branch ?? "",
      salesperson: inv.salesperson ?? "",
      date: inv.invoice_date,
      vat: inv.vat,
      variant: "original",
      lines,
    } as PaperData;
    existing = { id, status: inv.status, data, projectId: inv.project_id ?? "" };
    if (inv.status === "final") {
      // This invoice's own quantities are already deducted, so they count as available while editing.
      lines.forEach((l) => (stock[l.key] = (stock[l.key] ?? 0) + Number(l.qty)));
    }
  }

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
      <h1 className="text-3xl font-semibold print:hidden">{id ? t.docEdit : t.newTaxInvoice}</h1>
      <InvoiceForm
        t={t}
        defaultCompany={await loadCompanyDefault("invoice")}
        products={products}
        stock={stock}
        sellPrice={sellPrice}
        projects={projectOptions}
        salesperson=""
        salespeople={salespeople ?? []}
        existing={existing}
      />
    </section>
  );
}
