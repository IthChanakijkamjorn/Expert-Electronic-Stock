import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { signedUrls } from "@/lib/storage";
import { AddForm } from "@/components/AddForm";
import { ImageField } from "@/components/ImageField";
import { EditableGrid } from "@/components/EditableGrid";
import { createTower, deleteTowerInline, renameTower, reorderTowers } from "../actions";

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const { t } = await getDictionary();
  const supabase = await createClient();
  const role = await getRole();
  const canManage = role === "admin" || role === "manager";
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
    .order("position")
    .order("name");
  const urls = await signedUrls((towers ?? []).map((x) => x.image_path));

  const labels = {
    edit: t.editMode, done: t.doneEditing, rename: t.rename, save: t.save, cancel: t.cancel, failed: t.saveFailed,
    del: { delete: t.deleteTower, warning: t.deleteWarning, message: t.confirmDeleteTower, ok: t.ok, cancel: t.cancel },
  };
  const heading = (
    <>
      <Link href="/projects" className="text-sm text-muted hover:underline">{t.back}</Link>
      <p className="eyebrow mt-3">{t.organization}</p>
      <h1 className="text-3xl font-semibold">{org.name}</h1>
    </>
  );

  return (
    <section className={canManage ? "grid gap-8 lg:grid-cols-[65fr_35fr]" : ""}>
      <EditableGrid
        heading={heading}
        items={(towers ?? []).map((x) => ({
          id: x.id,
          href: `/projects/${orgId}/${x.id}`,
          title: x.name,
          subtitle: `${x.projects?.[0]?.count ?? 0} ${t.projectsCount}`,
          imageUrl: x.image_path ? urls.get(x.image_path) : undefined,
        }))}
        canManage={canManage}
        isAdmin={role === "admin"}
        empty={t.noItems}
        reorder={reorderTowers}
        rename={renameTower}
        remove={deleteTowerInline.bind(null, orgId)}
        labels={labels}
      />
      {canManage && (
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="mb-2 text-lg font-medium">{t.addTower}</h2>
          <AddForm action={createTower.bind(null, orgId)} submitLabel={t.save}>
            <label className="flex flex-col gap-1 text-sm">
              {t.name}
              <input name="name" required className="input" />
            </label>
            <ImageField label={t.image} uploadingText={t.uploading} failedText={t.uploadFailed} />
          </AddForm>
        </aside>
      )}
    </section>
  );
}
