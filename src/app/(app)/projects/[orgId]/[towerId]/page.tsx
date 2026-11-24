import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { signedUrls } from "@/lib/storage";
import { ImageField } from "@/components/ImageField";
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
    .select("id, name, year, notes, image_path, project_photos(storage_path)")
    .eq("tower_id", towerId)
    .order("year", { ascending: false })
    .order("name");

  const cover = (p: NonNullable<typeof projects>[number]) => p.image_path ?? p.project_photos?.[0]?.storage_path ?? null;
  const urls = await signedUrls((projects ?? []).map(cover));
  const byYear = new Map<number, NonNullable<typeof projects>>();
  (projects ?? []).forEach((p) => byYear.set(p.year, [...(byYear.get(p.year) ?? []), p]));
  const orgName = (tower.organizations as unknown as { name: string } | null)?.name;

  return (
    <section className={canManage ? "grid gap-8 lg:grid-cols-[65fr_35fr]" : ""}>
      <div className="flex flex-col gap-6">
      <div>
        <Link href={`/projects/${orgId}`} className="text-sm text-muted hover:underline">{t.back}</Link>
        <p className="eyebrow mt-3">{orgName}</p>
        <h1 className="page-title">{tower.name}</h1>
      </div>
      {byYear.size ? (
        [...byYear].map(([year, list]) => (
          <div key={year}>
            <h2 className="mb-2 font-serif text-2xl text-navy">{t.year} {year}</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${orgId}/${towerId}/${p.id}`}
                  className="group card card-link flex h-full flex-col !p-0"
                >
                  <div className="aspect-[16/9] shrink-0 overflow-hidden rounded-t-3xl bg-[#f5f5ff]">
                    {cover(p) && urls.get(cover(p)!) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={urls.get(cover(p)!)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-navy font-serif text-5xl text-white/70">
                        {p.name.trim().charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-navy">{p.name}</h3>
                    {p.notes && <p className="mt-1 line-clamp-2 text-sm text-muted">{p.notes}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))
      ) : (
        <p className="text-muted">{t.noItems}</p>
      )}
      </div>
      {canManage && (
        <aside className="lg:sticky lg:top-24 lg:self-start">
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
            <ImageField label={t.image} uploadingText={t.uploading} failedText={t.uploadFailed} />
            <button className="btn w-fit">{t.save}</button>
          </form>
        </aside>
      )}
    </section>
  );
}
