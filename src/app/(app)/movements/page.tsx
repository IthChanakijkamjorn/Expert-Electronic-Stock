import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { MovementForm } from "./MovementForm";

export default async function MovementsPage() {
  const { lang, t } = await getDictionary();
  const supabase = await createClient();
  const [{ data: products }, { data: movements }] = await Promise.all([
    supabase
      .from("product_stock")
      .select("id, name, sku, stock, unit")
      .eq("active", true)
      .order("name")
      .limit(1000),
    supabase
      .from("stock_movements")
      .select("id, quantity, type, comment, created_at, created_by, products(name)")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const ids = [...new Set((movements ?? []).map((m) => m.created_by))];
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">{t.movements}</h1>
      <MovementForm t={t} products={products ?? []} />
      <div>
        <h2 className="mb-2 text-lg font-medium">{t.recent}</h2>
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
                    {new Date(m.created_at).toLocaleString(lang === "th" ? "th-TH" : "en-GB")}
                  </td>
                  <td className="pr-3">{(m.products as unknown as { name: string } | null)?.name}</td>
                  <td className="pr-3 text-right">{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                  <td className="pr-3">{t.movementTypes[m.type as keyof typeof t.movementTypes]}</td>
                  <td className="pr-3">{m.comment}</td>
                  <td>{names.get(m.created_by) ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
