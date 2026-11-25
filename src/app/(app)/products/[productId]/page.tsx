import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { signedUrls } from "@/lib/storage";
import { FileUploader } from "@/components/FileUploader";
import { ActiveShares } from "@/components/ActiveShares";
import { ShareButton } from "@/components/ShareButton";
import { DeleteButton } from "@/components/DeleteButton";
import { ImageUploader } from "@/components/ImageUploader";
import { BrandLogo } from "@/components/BrandLogo";
import { setProductImage } from "../image-actions";
import { setPrices } from "../price-actions";
import { saveWebsiteSettings } from "../website-actions";
import { addProductFile, deleteProduct, deleteProductFile, updateProductDetails } from "../file-actions";

const formatSize = (n: number | null) =>
  n == null ? "" : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`;

export default async function ProductFilesPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const { lang, t } = await getDictionary();
  const supabase = await createClient();
  const role = await getRole();
  const canManage = role === "admin" || role === "manager";

  const { data: product } = await supabase
    .from("product_stock")
    .select("id, name:display_name, raw_name:name, model, brand, unit, stock, image_path, category, sub_category, description, short_description")
    .eq("id", productId)
    .maybeSingle();
  if (!product) notFound();

  const { data: files } = await supabase
    .from("product_files")
    .select("id, storage_path, file_name, size_bytes, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  const { data: shares } = files?.length
    ? await supabase
        .from("file_shares")
        .select("id, token, file_name, expires_at")
        .in("storage_path", files.map((f) => f.storage_path))
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
    : { data: [] };
  const { data: price } = canManage
    ? await supabase.from("product_prices").select("cost, sell_price").eq("product_id", productId).maybeSingle()
    : { data: null };
  const { data: web } = canManage
    ? await supabase.from("products").select("on_website, featured, website_datasheet_id, website_synced").eq("id", productId).single()
    : { data: null };
  const { data: brandRow } = product.brand
    ? await supabase.from("brands").select("logo_path").eq("name", product.brand).maybeSingle()
    : { data: null };
  const urls = await signedUrls([
    ...(files ?? []).map((f) => f.storage_path),
    product.image_path,
    brandRow?.logo_path,
  ]);
  const imageUrl = product.image_path ? urls.get(product.image_path) : undefined;
  const logoUrl = brandRow?.logo_path ? urls.get(brandRow.logo_path) : undefined;
  const shareLabels = {
    share: t.share,
    days: t.shareDays,
    hours: t.shareHours,
    create: t.createLink,
    copy: t.copy,
    copied: t.copied,
    failed: t.shareFailed,
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="card flex flex-col gap-5">
        <div className="flex flex-col gap-5 sm:flex-row">
          <div className="flex w-full shrink-0 flex-col items-start gap-2 sm:w-56">
            <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl bg-[#f5f5ff]">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt={product.name} className="h-full w-full object-contain p-2" />
              ) : (
                <span className="text-6xl opacity-30">📦</span>
              )}
            </div>
            {canManage && (
              <ImageUploader
                prefix={`images/products/${productId}`}
                record={setProductImage.bind(null, productId)}
                label={imageUrl ? t.changePhoto : t.addPhoto}
                failedText={t.uploadFailed}
              />
            )}
          </div>
          <div>
            <Link href={product.brand ? `/products/brand/${encodeURIComponent(product.brand)}` : "/products"} className="text-sm text-muted hover:underline">{t.back}</Link>
            <div className="mt-3 flex items-center gap-3">
              {product.brand && <BrandLogo name={product.brand} url={logoUrl} size={44} />}
              <p className="eyebrow">{[product.brand, product.model].filter(Boolean).join(" · ")}</p>
            </div>
            <h1 className="mt-2 text-3xl font-semibold">{product.name}</h1>
            {(product.category || product.sub_category) && (
              <p className="mt-1 text-sm text-muted">{[product.category, product.sub_category].filter(Boolean).join(" / ")}</p>
            )}
            {product.description && <p className="mt-3 max-w-2xl text-sm leading-relaxed">{product.description}</p>}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-[#f5f5ff] p-4">
            <p className="eyebrow">{t.stock}</p>
            <p className="mt-1 text-3xl font-bold text-navy">{product.stock}<span className="ml-1 text-sm font-medium text-muted">{product.unit}</span></p>
            <span className={`pill mt-2 ${product.stock <= 0 ? "bg-red-100 text-red-700" : product.stock < 5 ? "bg-yellow-200 text-yellow-800" : "bg-emerald-100 text-emerald-700"}`}>
              {product.stock <= 0 ? t.outOfStock : product.stock < 5 ? t.lowStock : t.inStock}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-[#ece8f2] pt-4">
          {canManage && (
            <details className="w-full">
              <summary className="btn-ghost inline-block cursor-pointer">✎ {t.editDetails}</summary>
              <form action={updateProductDetails.bind(null, productId)} className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="text-sm">{t.brand} *<input name="brand" required defaultValue={product.brand ?? ""} className="input mt-1" /></label>
                <label className="text-sm">{t.modelLabel} *<input name="model" required defaultValue={product.model ?? ""} className="input mt-1" /></label>
                <label className="text-sm">{t.name}<input name="name" defaultValue={product.raw_name ?? ""} placeholder={[product.brand, product.model].filter(Boolean).join(" ")} className="input mt-1" /></label>
                <label className="text-sm">{t.category}<input name="category" defaultValue={product.category ?? ""} className="input mt-1" /></label>
                <label className="text-sm">{t.subCategory}<input name="sub_category" defaultValue={product.sub_category ?? ""} className="input mt-1" /></label>
                <label className="text-sm sm:col-span-3">{t.descriptionLabel}<textarea name="description" rows={5} defaultValue={product.description ?? ""} className="input mt-1" /></label>
                <label className="text-sm sm:col-span-3">{t.shortDescriptionLabel}<textarea name="short_description" rows={2} defaultValue={product.short_description ?? ""} placeholder={t.shortDescriptionHint} className="input mt-1" /></label>
                <p className="text-xs text-muted sm:col-span-3">{t.nameHint}</p>
                <button className="btn sm:col-span-3 sm:w-fit">{t.save}</button>
              </form>
            </details>
          )}
          {role === "admin" && (
            <DeleteButton action={deleteProduct.bind(null, productId)} name={product.name} labels={{ delete: t.deleteProduct, warning: t.deleteWarning, message: t.confirmDeleteProduct, ok: t.ok, cancel: t.cancel }} />
          )}
        </div>
      </div>
      {canManage && (
        <>
          <h2 className="text-xl font-semibold text-navy">{t.prices}</h2>
          <form action={setPrices.bind(null, productId)} className="card flex flex-wrap items-end gap-3 p-4">
            <label className="text-sm">
              {t.costPrice}
              <input name="cost" type="number" min={0} step="0.01" defaultValue={price?.cost ?? ""} className="input mt-1 w-40" />
            </label>
            <label className="text-sm">
              {t.sellPrice}
              <input name="sell_price" type="number" min={0} step="0.01" defaultValue={price?.sell_price ?? ""} className="input mt-1 w-40" />
            </label>
            <button className="btn">{t.save}</button>
          </form>
          {web && (
            <>
              <h2 className="text-xl font-semibold text-navy">
                {t.website}
                {web.on_website && web.website_synced && <span className="pill ml-2 bg-emerald-100 align-middle text-emerald-700">✓</span>}
              </h2>
              <form action={saveWebsiteSettings.bind(null, productId)} className="card flex flex-col gap-3 p-4">
                <p className="text-sm text-muted">{t.websiteHelp}</p>
                <div className="flex flex-wrap items-end gap-5">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="on_website" defaultChecked={web.on_website} />
                    {t.showOnWebsite}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="featured" defaultChecked={!!web.featured} />
                    {t.featuredOnWebsite}
                  </label>
                  <label className="text-sm">
                    {t.websiteDatasheet}
                    <select name="datasheet" defaultValue={web.website_datasheet_id ?? ""} className="input mt-1">
                      <option value="">{t.noDatasheet}</option>
                      {(files ?? []).map((f) => (
                        <option key={f.id} value={f.id}>{f.file_name}</option>
                      ))}
                    </select>
                  </label>
                  <button className="btn">{t.saveAndPublish}</button>
                </div>
              </form>
            </>
          )}
        </>
      )}
      <h2 className="text-xl font-semibold text-navy">{t.files}</h2>
      <FileUploader
        prefix={`products/${productId}`}
        record={addProductFile.bind(null, productId)}
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
                <span className="flex flex-wrap items-center gap-4">
                  <span className="text-muted">
                    {new Date(f.created_at).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", { timeZone: "Asia/Bangkok" })}
                  </span>
                  {urls.get(f.storage_path) && (
                    <a href={urls.get(f.storage_path)} download={f.file_name} className="font-semibold text-navy underline">
                      {t.download}
                    </a>
                  )}
                  <ShareButton path={f.storage_path} fileName={f.file_name} labels={shareLabels} />
                  {canManage && (
                    <form action={deleteProductFile.bind(null, f.id)}>
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
        <>
          <h2 className="text-xl font-semibold text-navy">{t.activeLinks}</h2>
          <div className="card p-4">
            <ActiveShares shares={shares} locale={lang === "th" ? "th-TH" : "en-GB"} labels={{ copy: t.copy, copied: t.copied, revoke: t.revoke, expires: t.expires }} />
          </div>
        </>
      )}
    </section>
  );
}
