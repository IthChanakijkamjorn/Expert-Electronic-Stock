import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";

export default async function PlansPage() {
  const { lang, t } = await getDictionary();
  const role = await getRole();
  const supabase = await createClient();
  const { data } = await supabase
    .from("floor_plans").select("id, name, width_m, height_m, updated_at, projects(name)").order("updated_at", { ascending: false }).limit(200);
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">{t.floorPlans}</h1>
        {(role === "admin" || role === "manager") && <Link href="/floorplans/new" className="btn">{t.fpNew}</Link>}
      </div>
      <div className="card overflow-x-auto p-4">
        {data?.length ? (
          <table className="data-table w-full text-left text-sm">
            <thead><tr><th className="py-2 pr-3">{t.name}</th><th className="pr-3">{t.fpSize}</th><th className="pr-3">{t.projects}</th><th className="pr-3">{t.fpUpdated}</th><th /></tr></thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="border-t border-zinc-100">
                  <td className="py-2 pr-3"><Link href={`/floorplans/${p.id}`} className="font-semibold text-navy underline">{p.name}</Link></td>
                  <td className="pr-3">{Number(p.width_m)} × {Number(p.height_m)} m</td>
                  <td className="pr-3">{(p.projects as unknown as { name: string } | null)?.name ?? "—"}</td>
                  <td className="pr-3">{new Date(p.updated_at).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", { timeZone: "Asia/Bangkok" })}</td>
                  <td><a href={`/floorplans/${p.id}/pdf`} target="_blank" className="btn-ghost">PDF</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted">{t.noItems}</p>
        )}
      </div>
    </section>
  );
}
