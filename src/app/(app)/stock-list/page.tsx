import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";

export default async function StockListPage({ searchParams }: { searchParams: Promise<{ low?: string }> }) {
  const { low: onlyLow } = await searchParams;
  const { t } = await getDictionary();
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_stock").select("id, name, model, brand, unit, stock")
    .eq("active", true).order("name").limit(5000);
  const low = (data ?? []).filter((p) => !onlyLow || p.stock < 5);
  const groups = new Map<string, typeof low>();
  low.forEach((p) => {
    const b = p.brand?.trim() || t.noBrand;
    groups.set(b, [...(groups.get(b) ?? []), p]);
  });
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">{onlyLow ? t.lowStockTitle : t.stockList}</h1>
        <div className="flex flex-wrap gap-2">
          <Link href={onlyLow ? "/stock-list" : "/stock-list?low=1"} className="btn-ghost">{onlyLow ? t.showAllProducts : t.showLowOnly}</Link>
          <a href={onlyLow ? "/export/products?low=1" : "/export/products"} className="btn-ghost">⬇ {t.exportCsv}</a>
        </div>
      </div>
      {low.length === 0 && <p className="text-muted">{onlyLow ? t.noLowStock : t.noItems}</p>}
      {[...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([brand, items]) => (
        <div key={brand} className="card p-4">
          <h2 className="mb-2 font-semibold text-navy">{brand} <span className="text-muted">({items.length})</span></h2>
          <table className="data-table w-full text-left text-sm">
            <thead><tr><th className="py-1 pr-3">{t.modelLabel}</th><th className="pr-3">{t.name}</th><th className="pr-3 text-right">{t.stock}</th></tr></thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t border-zinc-100">
                  <td className="py-2 pr-3">{p.model}</td>
                  <td className="pr-3"><Link href={`/products/${p.id}`} className="font-semibold text-navy underline">{p.name}</Link></td>
                  <td className={`pr-3 text-right font-semibold ${p.stock <= 0 ? "text-red-700" : p.stock < 5 ? "text-yellow-700" : ""}`}>{p.stock} {p.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
