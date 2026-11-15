import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { signedUrls } from "@/lib/storage";
import { ActiveShares } from "@/components/ActiveShares";
import { ShareButton } from "@/components/ShareButton";
import { FileUploader } from "@/components/FileUploader";
import { MovementForm } from "../../../../movements/MovementForm";
import { DeleteButton } from "@/components/DeleteButton";
import { RenameForm } from "@/components/RenameForm";
import { AddForm } from "@/components/AddForm";
import { ProductPicker } from "../../../../movements/ProductPicker";
import { addProjectFile, deleteProject, deleteProjectFile, removeProjectItem, renameProject, setProjectItem } from "../../../actions";

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

  const [{ data: files }, { data: moves }, { data: products }, { data: planItems }, { data: prices }] = await Promise.all([
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
      .select("id, name, sku, brand, stock, unit")
      .eq("active", true)
      .order("name")
      .limit(1000),
    supabase
      .from("project_items")
      .select("id, product_id, planned_qty, products(name, unit)")
      .eq("project_id", projectId),
    canManage
      ? supabase.from("product_prices").select("product_id, cost")
      : Promise.resolve({ data: [] as { product_id: string; cost: number | null }[] }),
  ]);
  const { data: quotes } = canManage
    ? await supabase
        .from("quotations")
        .select("id, number, customer, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: null };
  const costOf = new Map((prices ?? []).map((p) => [p.product_id, Number(p.cost ?? 0)]));
  const { data: shares } = files?.length
    ? await supabase
        .from("file_shares")
        .select("id, token, file_name, expires_at")
        .in("storage_path", files.map((f) => f.storage_path))
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
    : { data: [] };
  const urls = await signedUrls((files ?? []).map((f) => f.storage_path));

  type Row = { name: string; unit: string; net: number; planned: number | null; itemId?: string; cost: number };
  const usage = new Map<string, Row>();
  (planItems ?? []).forEach((i) => {
    const p = i.products as unknown as { name: string; unit: string };
    usage.set(i.product_id, { name: p.name, unit: p.unit, net: 0, planned: i.planned_qty, itemId: i.id, cost: costOf.get(i.product_id) ?? 0 });
  });
  (moves ?? []).forEach((m) => {
    const p = m.products as unknown as { name: string; unit: string };
    const cur = usage.get(m.product_id) ?? { name: p.name, unit: p.unit, net: 0, planned: null, cost: costOf.get(m.product_id) ?? 0 };
    cur.net -= m.quantity;
    usage.set(m.product_id, cur);
  });

  const materialCost = [...usage.values()].reduce((sum, u) => sum + Math.max(u.net, 0) * u.cost, 0);
  const renameLabels = { rename: t.rename, save: t.save, cancel: t.cancel, failed: t.saveFailed };
  const shareLabels = {
    share: t.share,
    days: t.shareDays,
    hours: t.shareHours,
    create: t.createLink,
    copy: t.copy,
    copied: t.copied,
    failed: t.shareFailed,
  };
  const bound = addProjectFile.bind(null, projectId);

  return (
    <section className="flex flex-col gap-8">
      <div>
        <Link href={`/projects/${orgId}/${towerId}`} className="text-sm text-muted hover:underline">{t.back}</Link>
        <p className="eyebrow mt-3">
          {tower.organizations.name} · {tower.name} · {project.year}
        </p>
        <h1 className="text-3xl font-semibold">{project.name}</h1>
        {canManage && (
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <RenameForm initial={project.name} action={renameProject.bind(null, projectId)} labels={renameLabels} />
            {role === "admin" && (
              <DeleteButton action={deleteProject.bind(null, orgId, towerId, projectId)} name={project.name} labels={{ delete: t.deleteProject, warning: t.deleteWarning, message: t.confirmDeleteProject, ok: t.ok, cancel: t.cancel }} />
            )}
          </div>
        )}
        {project.notes && <p className="mt-2 text-muted">{project.notes}</p>}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-navy">{t.files}</h2>
        <FileUploader
          prefix={`projects/${projectId}`}
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
                    <ShareButton path={f.storage_path} fileName={f.file_name} labels={shareLabels} />
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
        {!!shares?.length && (
          <div className="card p-4">
            <h3 className="mb-2 font-medium">{t.activeLinks}</h3>
            <ActiveShares shares={shares} locale={lang === "th" ? "th-TH" : "en-GB"} labels={{ copy: t.copy, copied: t.copied, revoke: t.revoke, expires: t.expires }} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-navy">{t.plannedItems}</h2>
        {usage.size ? (
          <div className="card overflow-x-auto p-4">
            <table className="data-table w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="py-2 pr-3">{t.product}</th>
                  <th className="text-right">{t.planned}</th>
                  <th className="text-right">{t.used}</th>
                  <th className="text-right">{t.remaining}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...usage.values()].map((u) => {
                  const left = u.planned == null ? null : u.planned - u.net;
                  return (
                    <tr key={u.name}>
                      <td className="py-2 pr-3">{u.name}</td>
                      <td className="text-right">{u.planned == null ? "—" : `${u.planned} ${u.unit}`}</td>
                      <td className="text-right">{u.net} {u.unit}</td>
                      <td className="text-right">
                        {left == null ? (
                          <span className="text-muted">{t.notPlanned}</span>
                        ) : left < 0 ? (
                          <span className="font-semibold text-red-600">{t.overUsed} {-left}</span>
                        ) : left === 0 ? (
                          <span className="font-semibold text-green-700">{t.planDone}</span>
                        ) : (
                          `${left} ${u.unit}`
                        )}
                      </td>
                      <td className="text-right">
                        {canManage && u.itemId && (
                          <form action={removeProjectItem.bind(null, u.itemId)}>
                            <button className="text-red-600 underline">{t.remove}</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {canManage && (
              <p className="mt-3 text-right text-sm font-semibold">
                {t.materialCost}: {materialCost.toLocaleString(lang === "th" ? "th-TH" : "en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
          </div>
        ) : (
          <p className="text-muted">{t.noItems}</p>
        )}
        {canManage && (
          <>
            <h3 className="mt-2 font-medium">{t.quotation}</h3>
            <div className="flex flex-wrap gap-2">
              <Link href={`/quotations/new?project=${projectId}`} className="btn w-fit">{t.newQuotation}</Link>
              <Link href={`/floorplans/new?project=${projectId}`} className="btn-ghost">{t.fpNew}</Link>
              <Link href="/floorplans" className="btn-ghost">{t.floorPlans}</Link>
            </div>
            {quotes && quotes.length > 0 && (
              <div className="card p-4">
                <h4 className="mb-2 text-sm font-medium">{t.pastQuotations}</h4>
                <ul className="space-y-1 text-sm">
                  {quotes.map((q) => (
                    <li key={q.id}>
                      <Link className="underline" href={`/quotations/${q.id}`}>{q.number ?? t.draftLabel}</Link>
                      <span className="text-muted"> · {q.customer} · {q.created_at.slice(0, 10)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <h3 className="mt-2 font-medium">{t.addPlanned}</h3>
            <AddForm action={setProjectItem.bind(null, projectId)} submitLabel={t.save}>
              <ProductPicker products={products ?? []} placeholder={t.searchProducts} emptyText={t.noMatches} />
              <input name="planned_qty" type="number" min={1} required className="input" placeholder={t.quantity} />
            </AddForm>
          </>
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
