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
import { RenameForm } from "@/components/RenameForm";
import { ImageUploader } from "@/components/ImageUploader";
import { BrandLogo } from "@/components/BrandLogo";
import { setProductImage } from "../image-actions";
import { addSerials, deleteSerial, issueSerial, returnSerial } from "../serial-actions";
import { setPrices } from "../price-actions";
import { AddForm } from "@/components/AddForm";
import { addProductFile, deleteProduct, deleteProductFile, renameProduct } from "../file-actions";

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
    .select("id, name, sku, brand, unit, location, min_stock, stock, image_path")
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
  const { data: serials } = await supabase
    .from("product_serials")
    .select("id, serial, status, issued_to")
    .eq("product_id", productId)
    .order("serial")
    .limit(1000);
  const { data: price } = canManage
    ? await supabase.from("product_prices").select("cost, sell_price").eq("product_id", productId).maybeSingle()
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
              <p className="eyebrow">{[product.brand, product.sku].filter(Boolean).join(" · ")}</p>
            </div>
            <h1 className="mt-2 text-3xl font-semibold">{product.name}</h1>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-[#f5f5ff] p-4">
            <p className="eyebrow">{t.stock}</p>
            <p className="mt-1 text-3xl font-bold text-navy">{product.stock}<span className="ml-1 text-sm font-medium text-muted">{product.unit}</span></p>
            <span className={`pill mt-2 ${product.stock <= 0 ? "bg-red-100 text-red-700" : product.stock <= product.min_stock ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
              {product.stock <= 0 ? t.outOfStock : product.stock <= product.min_stock ? t.lowStock : t.inStock}
            </span>
          </div>
          <div className="rounded-2xl bg-[#f5f5ff] p-4">
            <p className="eyebrow">{t.location}</p>
            <p className="mt-1 text-lg font-semibold text-navy">{product.location || "—"}</p>
          </div>
          <div className="rounded-2xl bg-[#f5f5ff] p-4">
            <p className="eyebrow">{t.minStock}</p>
            <p className="mt-1 text-lg font-semibold text-navy">{product.min_stock} {product.unit}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-[#ece8f2] pt-4">
          {canManage && (
            <RenameForm initial={product.name} action={renameProduct.bind(null, productId)} labels={renameLabels} />
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
        </>
      )}
      <h2 className="text-xl font-semibold text-navy">{t.serials}</h2>
      <div className="card flex flex-col gap-3 p-4">
        {serials?.length ? (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-left text-sm">
              <tbody>
                {serials.map((s) => (
                  <tr key={s.id} className="border-t border-zinc-100">
                    <td className="py-2 pr-3 font-mono">{s.serial}</td>
                    <td className="pr-3">
                      <span className={`pill ${s.status === "issued" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {s.status === "issued" ? t.issuedTo : t.inStock}
                      </span>
                      {s.issued_to && <span className="ml-2 text-muted">{s.issued_to}</span>}
                    </td>
                    <td className="text-right">
                      {canManage && (
                        <span className="flex flex-wrap items-center justify-end gap-3">
                          {s.status === "issued" ? (
                            <form action={returnSerial.bind(null, productId, s.id)}>
                              <button className="font-semibold text-navy underline">{t.returnSerial}</button>
                            </form>
                          ) : (
                            <form action={issueSerial.bind(null, productId, s.id)} className="flex gap-2">
                              <input name="issued_to" className="input w-44" placeholder={t.issueTo} />
                              <button className="font-semibold text-navy underline">{t.issue}</button>
                            </form>
                          )}
                          <form action={deleteSerial.bind(null, productId, s.id)}>
                            <button className="text-red-600 underline">{t.remove}</button>
                          </form>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted">{t.noSerials}</p>
        )}
        {canManage && (
          <AddForm action={addSerials.bind(null, productId)} submitLabel={t.addSerials}>
            <textarea name="serials" rows={3} required className="input" placeholder={t.serialsHelp} />
          </AddForm>
        )}
      </div>
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
                    {new Date(f.created_at).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB")}
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
