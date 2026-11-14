import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { signedUrls } from "@/lib/storage";
import { AddForm } from "@/components/AddForm";
import { EntityCard } from "@/components/EntityCard";
import { ImageField } from "@/components/ImageField";
import { createTower } from "../actions";

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const { t } = await getDictionary();
  const supabase = await createClient();
  const role = await getRole();
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) notFound();
  const { data: towers } = await supabase
    .from("towers")
    .select("id, name, image_path, projects(count)")
    .eq("organization_id", orgId)
    .order("name");
  const urls = await signedUrls((towers ?? []).map((x) => x.image_path));

  return (
    <section className="flex flex-col gap-6">
      <div>
        <Link href="/projects" className="text-sm text-muted hover:underline">{t.back}</Link>
        <p className="eyebrow mt-3">{t.organization}</p>
        <h1 className="text-3xl font-semibold">{org.name}</h1>
      </div>
      {towers?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {towers.map((x) => (
            <EntityCard
              key={x.id}
              href={`/projects/${orgId}/${x.id}`}
              title={x.name}
              subtitle={`${x.projects?.[0]?.count ?? 0} ${t.projectsCount}`}
              imageUrl={x.image_path ? urls.get(x.image_path) : undefined}
            />
          ))}
        </div>
      ) : (
        <p className="text-muted">{t.noItems}</p>
      )}
      {(role === "admin" || role === "manager") && (
        <div className="max-w-md">
          <h2 className="mb-2 text-lg font-medium">{t.addTower}</h2>
          <AddForm action={createTower.bind(null, orgId)} submitLabel={t.save}>
            <label className="flex flex-col gap-1 text-sm">
              {t.name}
              <input name="name" required className="input" />
            </label>
            <ImageField label={t.image} uploadingText={t.uploading} failedText={t.uploadFailed} />
          </AddForm>
        </div>
      )}
    </section>
  );
}
