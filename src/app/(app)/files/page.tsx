import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { revokeShare } from "./actions";

export default async function FilesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const { lang, t } = await getDictionary();
  const supabase = await createClient();

  let query = supabase.from("products").select("id, sku, name, brand").eq("active", true).order("name").limit(500);
  const term = q.replace(/[%,()*\\]/g, " ").trim();
  if (term) query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%,brand.ilike.%${term}%`);

  const [{ data: products }, { data: fileRows }, { data: shares }] = await Promise.all([
    query,
    supabase.from("product_files").select("product_id").limit(10000),
    supabase
      .from("file_shares")
      .select("id, file_name, expires_at")
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  const counts = new Map<string, number>();
  fileRows?.forEach((r) => counts.set(r.product_id, (counts.get(r.product_id) ?? 0) + 1));
  const fmt = (d: string) => new Date(d).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB");

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">{t.filesMenu}</h1>
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder={t.search} className="input max-w-sm" />
        <button className="btn-ghost">{t.search}</button>
      </form>
      {products?.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Link key={p.id} href={`/files/${p.id}`} className="card transition hover:-translate-y-0.5">
              <p className="font-semibold text-navy">{p.name}</p>
              <p className="text-sm text-muted">{[p.sku, p.brand].filter(Boolean).join(" · ")}</p>
              <p className="mt-2 text-sm">{counts.get(p.id) ?? 0} {t.filesCount}</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-muted">{t.noProducts}</p>
      )}

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
    </section>
  );
}
