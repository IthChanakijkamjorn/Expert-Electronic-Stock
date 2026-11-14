import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { revokeShare } from "./file-actions";

export const NO_BRAND = "_";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const { lang, t } = await getDictionary();
  const supabase = await createClient();
  const role = await getRole();
  const term = q.replace(/[%,()*\\]/g, " ").trim();

  const columns = "id, sku, name, brand, unit, min_stock, stock";
  let query = supabase.from("product_stock").select(columns).eq("active", true).order("name").limit(1000);
  if (term) {
    query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%,brand.ilike.%${term}%`);
  }
  const [{ data: products }, { data: shares }] = await Promise.all([
    query,
    supabase
      .from("file_shares")
      .select("id, file_name, expires_at")
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const brands = new Map<string, number>();
  products?.forEach((p) => {
    const b = p.brand?.trim() || NO_BRAND;
    brands.set(b, (brands.get(b) ?? 0) + 1);
  });
  const sorted = [...brands.entries()].sort(([a], [b]) =>
    a === NO_BRAND ? 1 : b === NO_BRAND ? -1 : a.localeCompare(b),
  );
  const fmt = (d: string) => new Date(d).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB");

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t.products}</h1>
        {(role === "admin" || role === "manager") && (
          <Link href="/products/new" className="btn">{t.addProduct}</Link>
        )}
      </div>
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder={t.search} className="input max-w-sm" />
        <button className="btn-ghost">{t.search}</button>
      </form>

      {term ? (
        products?.length ? (
          <div className="card overflow-x-auto p-4">
            <table className="data-table w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="py-2 pr-3">{t.sku}</th>
                  <th className="pr-3">{t.name}</th>
                  <th className="pr-3">{t.brand}</th>
                  <th className="pr-3 text-right">{t.stock}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-3">{p.sku}</td>
                    <td className="pr-3">
                      <Link href={`/products/${p.id}`} className="font-semibold text-navy underline">{p.name}</Link>
                    </td>
                    <td className="pr-3">{p.brand}</td>
                    <td className="pr-3 text-right">{p.stock} {p.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted">{t.noProducts}</p>
        )
      ) : sorted.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {sorted.map(([brand, count]) => (
            <Link
              key={brand}
              href={`/products/brand/${encodeURIComponent(brand)}`}
              className="card transition hover:-translate-y-0.5"
            >
              <p className="text-xl font-semibold text-navy">{brand === NO_BRAND ? t.noBrand : brand}</p>
              <p className="mt-1 text-sm text-muted">{count} {t.items}</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-muted">{t.noProducts}</p>
      )}

      {!term && (
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold text-navy">{t.activeLinks}</h2>
          {shares?.length ? (
            <div className="card p-4">
              <ul className="divide-y divide-[#ece8f2] text-sm">
                {shares.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>{s.file_name}</span>
                    <span className="flex items-center gap-4">
                      <span className="text-muted">{t.expires} {fmt(s.expires_at)}</span>
                      <form action={revokeShare.bind(null, s.id)}>
                        <button className="text-red-600 underline">{t.revoke}</button>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-muted">{t.noLinks}</p>
          )}
        </div>
      )}
    </section>
  );
}
