import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { signedUrls } from "@/lib/storage";
import { BrandLogo } from "@/components/BrandLogo";
import { ImageUploader } from "@/components/ImageUploader";
import { FileUploader } from "@/components/FileUploader";
import { ShareButton } from "@/components/ShareButton";
import { setBrandLogo } from "../../image-actions";
import { addBrandFile, deleteBrandFile } from "../../catalog-actions";

const icon = (n: string) => {
  const e = n.split(".").pop()?.toLowerCase() ?? "";
  return e === "pdf" ? "📕" : ["xls", "xlsx", "csv"].includes(e) ? "📗" : ["doc", "docx"].includes(e) ? "📘" : ["ppt", "pptx"].includes(e) ? "📙" : ["zip", "rar", "7z"].includes(e) ? "🗜" : ["png", "jpg", "jpeg", "webp"].includes(e) ? "🖼" : "📄";
};

const formatSize = (n: number | null) =>
  n == null ? "" : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`;

export default async function BrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ brand: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { brand: raw } = await params;
  const { q = "" } = await searchParams;
  const brand = decodeURIComponent(raw);
  const title = brand === "_" ? undefined : brand;
  const { t } = await getDictionary();
  const supabase = await createClient();

  let query = supabase
    .from("product_stock")
    .select("id, model, name, unit, stock, image_path, category, sub_category")
    .eq("active", true)
    .order("category", { nullsFirst: false })
    .order("sub_category", { nullsFirst: false })
    .order("name")
    .limit(1000);
  query = brand === "_" ? query.is("brand", null) : query.eq("brand", brand);
  const term = q.replace(/[%,()*\\]/g, " ").trim();
  if (term) query = query.or(`name.ilike.%${term}%,model.ilike.%${term}%`);
  const role = await getRole();
  const canManage = role === "admin" || role === "manager";
  const [{ data: products }, { data: fileRows }, { data: brandRow }, { data: catalogs }] = await Promise.all([
    query,
    supabase.from("product_files").select("product_id").limit(10000),
    title ? supabase.from("brands").select("logo_path").eq("name", title).maybeSingle() : Promise.resolve({ data: null }),
    title ? supabase.from("brand_files").select("id, storage_path, file_name, size_bytes").eq("brand", title).order("created_at", { ascending: false }) : Promise.resolve({ data: null }),
  ]);
  const urls = await signedUrls([brandRow?.logo_path, ...(catalogs ?? []).map((c) => c.storage_path), ...(products ?? []).map((p) => p.image_path)]);
  const logoUrl = brandRow?.logo_path ? urls.get(brandRow.logo_path) : undefined;
  const counts = new Map<string, number>();
  fileRows?.forEach((r) => counts.set(r.product_id, (counts.get(r.product_id) ?? 0) + 1));

  const groups = [...(products ?? []).reduce((m, p) => {
    const k = [p.category, p.sub_category].filter(Boolean).join(" / ");
    return m.set(k, [...(m.get(k) ?? []), p]);
  }, new Map<string, NonNullable<typeof products>>())];

  return (
    <section className="flex flex-col gap-6">
      <div>
        <Link href="/products" className="text-sm text-muted hover:underline">{t.back}</Link>
        <div className="mt-3 flex items-center gap-4">
          <BrandLogo name={title ?? t.noBrand} url={logoUrl} size={64} />
          <div>
            <p className="eyebrow">{t.brand}</p>
            <h1 className="page-title">{title ?? t.noBrand}</h1>
          </div>
          {canManage && title && (
            <ImageUploader
              prefix="images/brands"
              record={setBrandLogo.bind(null, title)}
              label={logoUrl ? t.changeLogo : t.addLogo}
              failedText={t.uploadFailed}
            />
          )}
          <span className="pill ml-auto bg-white text-navy shadow-sm">{products?.length ?? 0} {t.items}</span>
        </div>
      </div>
      {title && (catalogs?.length || canManage) ? (
        <div className="flex flex-col gap-3">
          <h2 className="eyebrow">{t.catalogs}</h2>
          {canManage && (
            <FileUploader
              prefix="catalogs"
              record={addBrandFile.bind(null, title)}
              label={t.uploadCatalog}
              uploadingText={t.uploading}
              failedText={t.uploadFailed}
              ghost
            />
          )}
          {catalogs?.length ? (
            <div className="card p-4">
              <ul className="divide-y divide-[#ece8f2] text-sm">
                {catalogs.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>{icon(c.file_name)} {c.file_name} <span className="text-muted">{formatSize(c.size_bytes)}</span></span>
                    <span className="flex flex-wrap items-center gap-4">
                      {urls.get(c.storage_path) && (
                        <a href={urls.get(c.storage_path)} target="_blank" rel="noreferrer" className="font-semibold text-navy underline">{t.download}</a>
                      )}
                      <ShareButton
                        path={c.storage_path}
                        fileName={c.file_name}
                        labels={{ share: t.share, days: t.shareDays, hours: t.shareHours, create: t.createLink, copy: t.copy, copied: t.copied, failed: t.shareFailed }}
                      />
                      {canManage && (
                        <form action={deleteBrandFile.bind(null, c.id)}>
                          <button className="text-red-600 underline">{t.remove}</button>
                        </form>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted">{t.noCatalogs}</p>
          )}
        </div>
      ) : null}
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder={t.filterProducts} className="input max-w-sm" />
        <button className="btn-ghost">{t.search}</button>
      </form>
      {products?.length ? (
        <div className="flex flex-col gap-8">
          {groups.map(([cat, list]) => (
            <div key={cat} className="flex flex-col gap-3">
              {cat && <h2 className="eyebrow">{cat}</h2>}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const out = p.stock <= 0;
            const low = !out && p.stock < 5;
            const files = counts.get(p.id) ?? 0;
            return (
              <Link key={p.id} href={`/products/${p.id}`} className="card card-link flex flex-col gap-4">
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-[#f5f5ff]">
                  {p.image_path && urls.get(p.image_path) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={urls.get(p.image_path)} alt={p.name} loading="lazy" className="h-full w-full object-contain p-2" />
                  ) : (
                    <span className="text-4xl opacity-30">📦</span>
                  )}
                </div>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold leading-snug text-navy">{p.name}</h3>
                  <span className={`pill shrink-0 ${out ? "bg-red-100 text-red-700" : low ? "bg-yellow-200 text-yellow-800" : "bg-emerald-100 text-emerald-700"}`}>
                    {out ? t.outOfStock : low ? t.lowStock : t.inStock}
                  </span>
                </div>
                <div className="mt-auto flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-bold text-navy">{p.stock}<span className="ml-1 text-sm font-medium text-muted">{p.unit}</span></p>
                    <p className="text-xs text-muted">{p.model || "—"}</p>
                  </div>
                  <span className="pill bg-[#eeeefa] text-navy">📎 {files}</span>
                </div>
              </Link>
            );
          })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted">{t.noProducts}</p>
      )}
    </section>
  );
}
