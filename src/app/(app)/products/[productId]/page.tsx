import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { signedUrls } from "@/lib/storage";
import { FileUploader } from "@/components/FileUploader";
import { ShareButton } from "@/components/ShareButton";
import { addProductFile, deleteProductFile } from "../file-actions";

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
    .select("id, name, sku, brand, unit, location, min_stock, stock")
    .eq("id", productId)
    .maybeSingle();
  if (!product) notFound();

  const { data: files } = await supabase
    .from("product_files")
    .select("id, storage_path, file_name, size_bytes, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  const urls = await signedUrls((files ?? []).map((f) => f.storage_path));
  const shareLabels = {
    share: t.share,
    days: t.shareDays,
    create: t.createLink,
    copy: t.copy,
    copied: t.copied,
    failed: t.shareFailed,
  };

  return (
    <section className="flex flex-col gap-6">
      <div>
        <Link href={product.brand ? `/products/brand/${encodeURIComponent(product.brand)}` : "/products"} className="text-sm text-muted hover:underline">{t.back}</Link>
        <p className="eyebrow mt-3">{[product.sku, product.brand].filter(Boolean).join(" · ")}</p>
        <h1 className="text-3xl font-semibold">{product.name}</h1>
        <p className="mt-2 text-muted">
          {t.stock}: {product.stock} {product.unit}
          {product.location ? ` · ${t.location}: ${product.location}` : ""}
        </p>
        <h2 className="mt-6 text-xl font-semibold text-navy">{t.files}</h2>
      </div>
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
    </section>
  );
}
