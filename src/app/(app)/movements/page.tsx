import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { MovementForm } from "./MovementForm";

const PAGE_SIZE = 20;

export default async function MovementsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().replace(/[,()%*\\]/g, " ").trim();
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const { lang, t } = await getDictionary();
  const supabase = await createClient();

  let filter: string | null = null;
  if (q) {
    const [{ data: ps }, { data: us }] = await Promise.all([
      supabase.from("products").select("id").or(`name.ilike.%${q}%,model.ilike.%${q}%,brand.ilike.%${q}%`).limit(500),
      supabase.from("profiles").select("id").ilike("full_name", `%${q}%`).limit(100),
    ]);
    const parts = [`comment.ilike.%${q}%`];
    if (ps?.length) parts.push(`product_id.in.(${ps.map((p) => p.id).join(",")})`);
    if (us?.length) parts.push(`created_by.in.(${us.map((u) => u.id).join(",")})`);
    filter = parts.join(",");
  }
  let movementsQuery = supabase
    .from("stock_movements")
    .select("id, quantity, type, comment, created_at, created_by, products(name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (filter) movementsQuery = movementsQuery.or(filter);

  const [{ data: products }, { data: movements, count }, { data: projects }] = await Promise.all([
    supabase
      .from("product_stock")
      .select("id, name, model, brand, stock, unit")
      .eq("active", true)
      .order("name")
      .limit(1000),
    movementsQuery,
    supabase
      .from("projects")
      .select("id, name, year, towers(name, organizations(name))")
      .order("year", { ascending: false })
      .limit(500),
  ]);
  const projectOptions = (projects ?? []).map((p) => {
    const tw = p.towers as unknown as { name: string; organizations: { name: string } };
    return { id: p.id, label: `${tw.organizations.name} › ${tw.name} › ${p.year} › ${p.name}` };
  });

  const ids = [...new Set((movements ?? []).map((m) => m.created_by))];
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const href = (n: number) => `/movements?${new URLSearchParams({ ...(q ? { q } : {}), page: String(n) })}`;
  const pager = (
    <div className="flex items-center justify-between py-2 text-sm">
      {page > 1 ? <Link className="btn-ghost" href={href(page - 1)}>← {t.prev}</Link> : <span />}
      <span className="text-muted">{t.pageOf} {page} / {totalPages}</span>
      {page < totalPages ? <Link className="btn-ghost" href={href(page + 1)}>{t.next} →</Link> : <span />}
    </div>
  );

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">{t.movements}</h1>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-lg font-medium">{t.recent}</h2>
            <a href="/export/movements" className="btn-ghost">⬇ {t.exportCsv}</a>
          </div>
          <form className="mb-2 flex gap-2">
            <input name="q" defaultValue={q} placeholder={t.searchHistory} className="input" />
            <button className="btn">{t.search}</button>
          </form>
          {totalPages > 1 && pager}
          <div className="card overflow-x-auto p-4">
            <table className="data-table w-full text-left text-sm">
              <thead className="border-b border-zinc-300">
                <tr>
                  <th className="py-2 pr-3">{t.date}</th>
                  <th className="pr-3">{t.product}</th>
                  <th className="pr-3 text-right">{t.quantity}</th>
                  <th className="pr-3">{t.reason}</th>
                  <th className="pr-3">{t.comment}</th>
                  <th>{t.by}</th>
                </tr>
              </thead>
              <tbody>
                {(movements ?? []).map((m) => (
                  <tr key={m.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {new Date(m.created_at).toLocaleString(lang === "th" ? "th-TH" : "en-GB", { timeZone: "Asia/Bangkok" })}
                    </td>
                    <td className="pr-3">{(m.products as unknown as { name: string } | null)?.name}</td>
                    <td className="pr-3 text-right">{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                    <td className="pr-3">{t.movementTypes[m.type as keyof typeof t.movementTypes]}</td>
                    <td className="pr-3">{m.comment}</td>
                    <td>{names.get(m.created_by) ?? ""}</td>
                  </tr>
                ))}
                {(movements ?? []).length === 0 && (
                  <tr><td colSpan={7} className="py-4 text-center text-muted">{t.noMatches}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && pager}
        </div>
        <div className="lg:sticky lg:top-4">
          <MovementForm t={t} products={products ?? []} projects={projectOptions} />
        </div>
      </div>
    </section>
  );
}
