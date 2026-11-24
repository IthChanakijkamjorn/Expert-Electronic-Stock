import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { signedUrls } from "@/lib/storage";
import { AddForm } from "@/components/AddForm";
import { ImageField } from "@/components/ImageField";
import { EditableGrid } from "@/components/EditableGrid";
import { createOrganization, deleteOrganization, deleteOrganizationInline, renameOrganization, reorderOrganizations } from "./actions";

export default async function ProjectsPage() {
  const { t } = await getDictionary();
  const supabase = await createClient();
  const role = await getRole();
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, image_path, towers(count)")
    .order("position")
    .order("name");
  const urls = await signedUrls((orgs ?? []).map((o) => o.image_path));

  const canManage = role === "admin" || role === "manager";
  const labels = {
    edit: t.editMode, done: t.doneEditing, rename: t.rename, save: t.save, cancel: t.cancel, failed: t.saveFailed,
    del: { delete: t.deleteOrganization, warning: t.deleteWarning, message: t.confirmDeleteOrganization, ok: t.ok, cancel: t.cancel },
  };

  return (
    <section className={canManage ? "grid gap-8 lg:grid-cols-[65fr_35fr]" : ""}>
      <EditableGrid
        heading={<h1 className="page-title">{t.organizations}</h1>}
        items={(orgs ?? []).map((o) => ({
          id: o.id,
          href: `/projects/${o.id}`,
          title: o.name,
          subtitle: `${o.towers?.[0]?.count ?? 0} ${t.towers}`,
          imageUrl: o.image_path ? urls.get(o.image_path) : undefined,
        }))}
        canManage={canManage}
        isAdmin={role === "admin"}
        empty={t.noItems}
        reorder={reorderOrganizations}
        rename={renameOrganization}
        remove={deleteOrganizationInline}
        labels={labels}
      />
      {canManage && (
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="mb-2 text-lg font-medium">{t.addOrganization}</h2>
          <AddForm action={createOrganization} submitLabel={t.save}>
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
