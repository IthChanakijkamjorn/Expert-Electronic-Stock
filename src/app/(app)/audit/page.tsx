import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";

export default async function AuditPage() {
  if ((await getRole()) !== "admin") notFound();
  const { lang, t } = await getDictionary();
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("audit_log").select("id, actor, action, entity, entity_name, created_at")
    .order("created_at", { ascending: false }).limit(200);
  const ids = [...new Set((rows ?? []).map((r) => r.actor).filter(Boolean))] as string[];
  const { data: people } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">{t.auditLog}</h1>
      <div className="card overflow-x-auto p-4">
        <table className="data-table w-full text-left text-sm">
          <thead className="border-b border-zinc-300">
            <tr><th className="py-2 pr-3">{t.date}</th><th className="pr-3">{t.by}</th><th className="pr-3">{t.action}</th><th>{t.name}</th></tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id} className="border-b border-zinc-100">
                <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString(lang === "th" ? "th-TH" : "en-GB")}</td>
                <td className="pr-3">{r.actor ? names.get(r.actor) : ""}</td>
                <td className="pr-3">{r.action} · {r.entity}</td>
                <td>{r.entity_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
