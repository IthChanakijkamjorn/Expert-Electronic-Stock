import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { createProject } from "../../actions";

export default async function TowerPage({
  params,
}: {
  params: Promise<{ orgId: string; towerId: string }>;
}) {
  const { orgId, towerId } = await params;
  const { t } = await getDictionary();
  const supabase = await createClient();
  const role = await getRole();
  const canManage = role === "admin" || role === "manager";
  const { data: tower } = await supabase
    .from("towers")
    .select("id, name, organizations(name)")
    .eq("id", towerId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!tower) notFound();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, year, notes")
    .eq("tower_id", towerId)
    .order("year", { ascending: false })
    .order("name");

  const byYear = new Map<number, NonNullable<typeof projects>>();
  (projects ?? []).forEach((p) => byYear.set(p.year, [...(byYear.get(p.year) ?? []), p]));
  const orgName = (tower.organizations as unknown as { name: string } | null)?.name;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <Link href={`/projects/${orgId}`} className="text-sm text-muted hover:underline">{t.back}</Link>
        <p className="eyebrow mt-3">{orgName}</p>
        <h1 className="text-3xl font-semibold">{tower.name}</h1>
      </div>
      {byYear.size ? (
        [...byYear].map(([year, list]) => (
          <div key={year}>
            <h2 className="mb-2 font-serif text-2xl text-navy">{t.year} {year}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${orgId}/${towerId}/${p.id}`}
                  className="card card-link"
                >
                  <h3 className="font-semibold text-navy">{p.name}</h3>
                  {p.notes && <p className="mt-1 line-clamp-2 text-sm text-muted">{p.notes}</p>}
                </Link>
              ))}
            </div>
          </div>
        ))
      ) : (
        <p className="text-muted">{t.noItems}</p>
      )}
      {canManage && (
        <div className="max-w-md">
          <h2 className="mb-2 text-lg font-medium">{t.addProject}</h2>
          <form action={createProject.bind(null, orgId, towerId)} className="card flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              {t.projectName}
              <input name="name" required className="input" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t.year}
              <input name="year" type="number" required min={1990} max={2200} defaultValue={new Date().getFullYear()} className="input" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t.notes}
              <textarea name="notes" rows={2} className="input" />
            </label>
            <button className="btn w-fit">{t.save}</button>
          </form>
        </div>
      )}
    </section>
  );
}
