import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";

export default async function BrandPage({ params }: { params: Promise<{ brand: string }> }) {
  const { brand: raw } = await params;
  const brand = decodeURIComponent(raw);
  const { t } = await getDictionary();
  const supabase = await createClient();

  let query = supabase
    .from("product_stock")
    .select("id, sku, name, unit, min_stock, stock")
    .eq("active", true)
    .order("name")
    .limit(1000);
  query = brand === "_" ? query.is("brand", null) : query.eq("brand", brand);
  const [{ data: products }, { data: fileRows }] = await Promise.all([
    query,
    supabase.from("product_files").select("product_id").limit(10000),
  ]);
  const counts = new Map<string, number>();
  fileRows?.forEach((r) => counts.set(r.product_id, (counts.get(r.product_id) ?? 0) + 1));

  return (
    <section className="flex flex-col gap-4">
      <div>
        <Link href="/products" className="text-sm text-muted hover:underline">{t.back}</Link>
        <p className="eyebrow mt-3">{t.brand}</p>
        <h1 className="text-3xl font-semibold">{brand === "_" ? t.noBrand : brand}</h1>
      </div>
      {products?.length ? (
        <div className="card overflow-x-auto p-4">
          <table className="data-table w-full text-left text-sm">
            <thead>
              <tr>
                <th className="py-2 pr-3">{t.sku}</th>
                <th className="pr-3">{t.name}</th>
                <th className="pr-3 text-right">{t.stock}</th>
                <th className="text-right">{t.files}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 pr-3">{p.sku}</td>
                  <td className="pr-3">
                    <Link href={`/products/${p.id}`} className="font-semibold text-navy underline">{p.name}</Link>
                  </td>
                  <td className="pr-3 text-right">
                    {p.stock} {p.unit}
                    {p.stock <= p.min_stock && (
                      <span className="ml-2 rounded bg-red-100 px-1.5 text-xs text-red-700">{t.lowStock}</span>
                    )}
                  </td>
                  <td className="text-right">{counts.get(p.id) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted">{t.noProducts}</p>
      )}
    </section>
  );
}
