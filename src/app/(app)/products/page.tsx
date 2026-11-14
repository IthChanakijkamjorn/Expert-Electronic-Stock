import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const { t } = await getDictionary();
  const supabase = await createClient();
  const role = await getRole();

  let query = supabase
    .from("product_stock")
    .select("id, sku, name, brand, unit, location, min_stock, stock")
    .eq("active", true)
    .order("name")
    .limit(500);
  // Strip characters that have meaning in PostgREST filter syntax.
  const term = q.replace(/[%,()*\\]/g, " ").trim();
  if (term) {
    query = query.or(
      `name.ilike.%${term}%,sku.ilike.%${term}%,brand.ilike.%${term}%`,
    );
  }
  const { data: products } = await query;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t.products}</h1>
        {(role === "admin" || role === "manager") && (
          <Link href="/products/new" className="btn">
            {t.addProduct}
          </Link>
        )}
      </div>
      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder={t.search}
          className="input max-w-sm"
        />
        <button className="btn-ghost">{t.search}</button>
      </form>
      {products?.length ? (
        <div className="card overflow-x-auto p-4">
          <table className="data-table w-full text-left text-sm">
            <thead className="border-b border-zinc-300">
              <tr>
                <th className="py-2 pr-3">{t.sku}</th>
                <th className="pr-3">{t.name}</th>
                <th className="pr-3">{t.brand}</th>
                <th className="pr-3">{t.location}</th>
                <th className="pr-3 text-right">{t.stock}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-zinc-100">
                  <td className="py-2 pr-3">{p.sku}</td>
                  <td className="pr-3">{p.name}</td>
                  <td className="pr-3">{p.brand}</td>
                  <td className="pr-3">{p.location}</td>
                  <td className="pr-3 text-right">
                    {p.stock} {p.unit}
                    {p.stock <= p.min_stock && (
                      <span className="ml-2 rounded bg-red-100 px-1.5 text-xs text-red-700">
                        {t.lowStock}
                      </span>
                    )}
                  </td>
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
