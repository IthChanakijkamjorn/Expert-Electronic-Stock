import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { submitStocktake } from "./actions";

export default async function StocktakePage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; done?: string }>;
}) {
  const { brand, done } = await searchParams;
  const { t } = await getDictionary();
  const role = await getRole();
  if (role !== "admin" && role !== "manager") redirect("/");

  const supabase = await createClient();
  const { data } = await supabase
    .from("product_stock")
    .select("id, name, sku, brand, unit, stock")
    .eq("active", true)
    .order("name")
    .limit(3000);
  const all = data ?? [];
  const brandOf = (b: string | null) => b?.trim() || "";
  const brands = [...new Set(all.map((p) => brandOf(p.brand)))].sort((a, b) => a.localeCompare(b));
  const items = brand === undefined ? [] : all.filter((p) => brandOf(p.brand) === brand);

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold">{t.stocktake}</h1>
        <p className="mt-1 text-muted">{t.stocktakeHelp}</p>
      </div>

      {done !== undefined && (
        <p className="card border-green-600 p-3 text-green-700">{t.stocktakeDone.replace("{n}", done)}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {brands.map((b) => (
          <Link
            key={b || "none"}
            href={`/stocktake?brand=${encodeURIComponent(b)}`}
            className={b === brand ? "btn" : "btn-ghost"}
          >
            {b || t.noBrand}
          </Link>
        ))}
      </div>

      {brand !== undefined && (
        <form action={submitStocktake.bind(null, brand)} className="card flex flex-col gap-4 p-4">
          <div className="overflow-x-auto">
            <table className="data-table w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="py-2 pr-3">{t.sku}</th>
                  <th className="pr-3">{t.name}</th>
                  <th className="pr-3 text-right">{t.systemStock}</th>
                  <th className="text-right">{t.counted}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-t border-zinc-100">
                    <td className="py-2 pr-3">{p.sku}</td>
                    <td className="pr-3">{p.name}</td>
                    <td className="pr-3 text-right">{p.stock} {p.unit}</td>
                    <td className="text-right">
                      <input name={`count_${p.id}`} type="number" min={0} className="input w-28 text-right" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn w-fit">{t.saveStocktake}</button>
        </form>
      )}
    </section>
  );
}
