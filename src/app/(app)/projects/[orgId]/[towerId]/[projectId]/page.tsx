import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { signedUrls } from "@/lib/storage";
import { FileUploader } from "@/components/FileUploader";
import { MovementForm } from "../../../../movements/MovementForm";
import { addProjectFile, deleteProjectFile } from "../../../actions";

const formatSize = (n: number | null) =>
  n == null ? "" : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`;

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ orgId: string; towerId: string; projectId: string }>;
}) {
  const { orgId, towerId, projectId } = await params;
  const { lang, t } = await getDictionary();
  const supabase = await createClient();
  const role = await getRole();
  const canManage = role === "admin" || role === "manager";

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, year, notes, towers(id, name, organization_id, organizations(name))")
    .eq("id", projectId)
    .eq("tower_id", towerId)
    .maybeSingle();
  if (!project) notFound();
  const tower = project.towers as unknown as {
    name: string;
    organization_id: string;
    organizations: { name: string };
  };
  if (tower.organization_id !== orgId) notFound();

  const [{ data: files }, { data: moves }, { data: products }] = await Promise.all([
    supabase
      .from("project_files")
      .select("id, storage_path, file_name, size_bytes, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    supabase
      .from("stock_movements")
      .select("quantity, product_id, products(name, unit)")
      .eq("project_id", projectId),
    supabase
      .from("product_stock")
      .select("id, name, sku, stock, unit")
      .eq("active", true)
      .order("name")
      .limit(1000),
  ]);
  const urls = await signedUrls((files ?? []).map((f) => f.storage_path));

  const usage = new Map<string, { name: string; unit: string; net: number }>();
  (moves ?? []).forEach((m) => {
    const p = m.products as unknown as { name: string; unit: string };
    const cur = usage.get(m.product_id) ?? { name: p.name, unit: p.unit, net: 0 };
    cur.net -= m.quantity;
    usage.set(m.product_id, cur);
  });

  const bound = addProjectFile.bind(null, projectId);

  return (
    <section className="flex flex-col gap-8">
      <div>
        <Link href={`/projects/${orgId}/${towerId}`} className="text-sm text-muted hover:underline">{t.back}</Link>
        <p className="eyebrow mt-3">
          {tower.organizations.name} · {tower.name} · {project.year}
        </p>
        <h1 className="text-3xl font-semibold">{project.name}</h1>
        {project.notes && <p className="mt-2 text-muted">{project.notes}</p>}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-navy">{t.files}</h2>
        <FileUploader
          projectId={projectId}
          record={bound}
          label={t.uploadFiles}
          uploadingText={t.uploading}
          failedText={t.uploadFailed}
        />
        {files?.length ? (
          <div className="card p-4">
            <ul className="divide-y divide-[#ece8f2] text-sm">
              {files.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {f.file_name} <span className="text-muted">{formatSize(f.size_bytes)}</span>
                  </span>
                  <span className="flex items-center gap-4">
                    <span className="text-muted">
                      {new Date(f.created_at).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB")}
                    </span>
                    {urls.get(f.storage_path) && (
                      <a href={urls.get(f.storage_path)} download={f.file_name} className="font-semibold text-navy underline">
                        {t.download}
                      </a>
                    )}
                    {canManage && (
                      <form action={deleteProjectFile.bind(null, f.id)}>
                        <button className="text-red-600 underline">{t.remove}</button>
                      </form>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-muted">{t.noFiles}</p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-navy">{t.usedProducts}</h2>
        {usage.size ? (
          <div className="card p-4">
            <table className="data-table w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="py-2 pr-3">{t.product}</th>
                  <th className="text-right">{t.netUsed}</th>
                </tr>
              </thead>
              <tbody>
                {[...usage.values()].map((u) => (
                  <tr key={u.name}>
                    <td className="py-2 pr-3">{u.name}</td>
                    <td className="text-right">{u.net} {u.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted">{t.noItems}</p>
        )}
        <h3 className="mt-2 font-medium">{t.useProduct}</h3>
        <MovementForm
          t={t}
          products={products ?? []}
          fixedProjectId={projectId}
          defaultDirection="out"
          defaultType="project_use"
        />
      </div>
    </section>
  );
}
