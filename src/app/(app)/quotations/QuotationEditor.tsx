import { loadCompanyDefault } from "@/lib/companyDefaults";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { fetchAll } from "@/lib/fetchAll";
import { signedUrls } from "@/lib/storage";
import { QuotationForm } from "./new/QuotationForm";
import { mergeDocCompany } from "@/lib/company";
import type { QuotePaperData } from "@/components/QuotationPaper";

export async function QuotationEditor({ id, project }: { id?: string; project?: string }) {
  const role = await getRole();
  if (role !== "admin" && role !== "manager") redirect("/documents");
  const { t } = await getDictionary();
  const supabase = await createClient();

  const [products, prices, { data: projects }, { data: sigs }, { data: salespeople }] = await Promise.all([
    fetchAll((a, b) => supabase.from("products").select("id, name, model, brand, unit").eq("active", true).order("id").range(a, b)),
    fetchAll((a, b) => supabase.from("product_prices").select("product_id, sell_price").order("product_id").range(a, b)),
    supabase.from("projects").select("id, name, year, towers(name, organizations(name))").order("year", { ascending: false }).limit(500),
    supabase.from("signatures").select("id, name, path, is_default").order("created_at"),
    supabase.from("salespeople").select("id, name").order("name"),
  ]);

  const sellPrice: Record<string, number> = {};
  prices.forEach((p) => {
    if (p.sell_price !== null) sellPrice[p.product_id] = Number(p.sell_price);
  });
  const projectOptions = (projects ?? []).map((p) => {
    const tw = p.towers as unknown as { name: string; organizations: { name: string } };
    return { id: p.id, name: p.name, org: tw.organizations.name, label: `${tw.organizations.name} › ${tw.name} › ${p.year} › ${p.name}` };
  });

  // Prefill from a project: its planned list, or what it has used when nothing is planned.
  const initial = new Map<string, number>();
  const chosen = projectOptions.find((p) => p.id === project);
  if (chosen) {
    const [{ data: plan }, { data: moves }] = await Promise.all([
      supabase.from("project_items").select("product_id, planned_qty").eq("project_id", chosen.id),
      supabase.from("stock_movements").select("product_id, quantity").eq("project_id", chosen.id),
    ]);
    if (plan?.length) plan.forEach((i) => initial.set(i.product_id, i.planned_qty));
    else (moves ?? []).forEach((m) => initial.set(m.product_id, (initial.get(m.product_id) ?? 0) - m.quantity));
  }

  const urls = await signedUrls((sigs ?? []).map((s) => s.path));

  let existing: React.ComponentProps<typeof QuotationForm>["existing"];
  if (id) {
    const { data: q } = await supabase.from("quotations").select("*").eq("id", id).maybeSingle();
    if (!q) notFound();
    const dropped = 0;
    const lines: QuotePaperData["lines"] = [];
    for (const l of q.lines as { product_id?: string; brand: string; model: string; name: string; unit: string; qty: number; price: number }[]) {
      // Older quotations did not store the product id, so match by model + name, then by name.
      const p =
        products.find((x) => x.id === l.product_id) ??
        products.find((x) => (x.model ?? "") === l.model && x.name === l.name) ??
        products.find((x) => x.name === l.name);
      if (!p) {
        lines.push({ key: `free${lines.length}`, brand: l.brand, model: l.model, name: l.name, unit: l.unit, qty: String(l.qty), price: String(l.price) });
        continue;
      }
      lines.push({ key: p.id, productId: p.id, brand: l.brand, model: l.model, name: l.name, unit: l.unit, qty: String(l.qty), price: String(l.price) });
    }
    const sigPath = (sigs ?? []).find((s) => s.id === q.signature_id)?.path;
    const data: QuotePaperData = {
      number: q.number ?? "DRAFT",
      company: mergeDocCompany(q.company, "quote"),
      customer: q.status === "draft" && q.customer === "-" ? "" : q.customer,
      attention: q.attention ?? "",
      project: q.project_label ?? "",
      phone: q.phone ?? "",
      email: q.email ?? "",
      date: q.quote_date,
      validDays: q.valid_days === null ? "" : String(q.valid_days),
      leadDays: q.lead_days === null ? "" : String(q.lead_days),
      warrantyYears: q.warranty_years === null ? "" : String(Number(q.warranty_years)),
      quotedBy: q.quoted_by ?? "",
      paymentTerms: q.payment_terms ?? "",
      discountPct: String(Number(q.discount_pct)),
      vat: q.vat,
      variant: "original",
      signatureUrl: sigPath ? (urls.get(sigPath) ?? null) : null,
      lines,
    };
    existing = { id, data, projectId: q.project_id ?? "", sigId: q.signature_id ?? "", dropped };
  }
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">{id ? t.docEdit : t.newQuotation}</h1>
      <QuotationForm
        t={t}
        defaultCompany={await loadCompanyDefault("quote")}
        products={products}
        sellPrice={sellPrice}
        projects={projectOptions}
        signatures={(sigs ?? []).map((s) => ({ id: s.id, name: s.name, url: urls.get(s.path) ?? null, is_default: s.is_default }))}
        initialProject={chosen?.id ?? ""}
        initialLines={[...initial].filter(([, q]) => q > 0).map(([id, qty]) => ({ id, qty }))}
        customer={chosen?.org ?? ""}
        quotedBy=""
        salespeople={salespeople ?? []}
        existing={existing}
      />
    </section>
  );
}
