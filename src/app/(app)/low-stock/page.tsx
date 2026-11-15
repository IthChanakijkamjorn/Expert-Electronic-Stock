import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";

export default async function LowStockPage() {
  const { t } = await getDictionary();
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_stock").select("id, name, sku, brand, unit, min_stock, stock")
    .eq("active", true).order("name").limit(2000);
  const low = (data ?? []).filter((p) => p.stock <= p.min_stock);
  const groups = new Map<string, typeof low>();
  low.forEach((p) => {
    const b = p.brand?.trim() || t.noBrand;
    groups.set(b, [...(groups.get(b) ?? []), p]);
  });
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t.lowStockTitle}</h1>
        <a href="/export/products?low=1" className="btn-ghost">⬇ {t.exportCsv}</a>
      </div>
      {low.length === 0 && <p className="text-muted">{t.noLowStock}</p>}
      {[...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([brand, items]) => (
        <div key={brand} className="card p-4">
          <h2 className="mb-2 font-semibold text-navy">{brand} <span className="text-muted">({items.length})</span></h2>
          <table className="data-table w-full text-left text-sm">
            <thead><tr><th className="py-1 pr-3">{t.sku}</th><th className="pr-3">{t.name}</th><th className="pr-3 text-right">{t.stock}</th><th className="text-right">{t.minStock}</th></tr></thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t border-zinc-100">
                  <td className="py-2 pr-3">{p.sku}</td>
                  <td className="pr-3"><Link href={`/products/${p.id}`} className="font-semibold text-navy underline">{p.name}</Link></td>
                  <td className={`pr-3 text-right font-semibold ${p.stock <= 0 ? "text-red-700" : "text-amber-700"}`}>{p.stock} {p.unit}</td>
                  <td className="text-right">{p.min_stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
