import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { signedUrls } from "@/lib/storage";
import { AddForm } from "@/components/AddForm";
import { EntityCard } from "@/components/EntityCard";
import { ImageField } from "@/components/ImageField";
import { createOrganization } from "./actions";

export default async function ProjectsPage() {
  const { t } = await getDictionary();
  const supabase = await createClient();
  const role = await getRole();
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, image_path, towers(count)")
    .order("name");
  const urls = await signedUrls((orgs ?? []).map((o) => o.image_path));

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">{t.organizations}</h1>
      {orgs?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map((o) => (
            <EntityCard
              key={o.id}
              href={`/projects/${o.id}`}
              title={o.name}
              subtitle={`${o.towers?.[0]?.count ?? 0} ${t.towers}`}
              imageUrl={o.image_path ? urls.get(o.image_path) : undefined}
            />
          ))}
        </div>
      ) : (
        <p className="text-muted">{t.noItems}</p>
      )}
      {(role === "admin" || role === "manager") && (
        <div className="max-w-md">
          <h2 className="mb-2 text-lg font-medium">{t.addOrganization}</h2>
          <AddForm action={createOrganization} submitLabel={t.save}>
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
