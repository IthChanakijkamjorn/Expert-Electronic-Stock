import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { signedUrls } from "@/lib/storage";
import { BrandLogo } from "@/components/BrandLogo";
import { ImageUploader } from "@/components/ImageUploader";
import { setBrandLogo } from "../../image-actions";

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
    .select("id, sku, name, unit, min_stock, stock, image_path")
    .eq("active", true)
    .order("name")
    .limit(1000);
  query = brand === "_" ? query.is("brand", null) : query.eq("brand", brand);
  const term = q.replace(/[%,()*\\]/g, " ").trim();
  if (term) query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
  const role = await getRole();
  const canManage = role === "admin" || role === "manager";
  const [{ data: products }, { data: fileRows }, { data: brandRow }] = await Promise.all([
    query,
    supabase.from("product_files").select("product_id").limit(10000),
    title ? supabase.from("brands").select("logo_path").eq("name", title).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const urls = await signedUrls([brandRow?.logo_path, ...(products ?? []).map((p) => p.image_path)]);
  const logoUrl = brandRow?.logo_path ? urls.get(brandRow.logo_path) : undefined;
  const counts = new Map<string, number>();
  fileRows?.forEach((r) => counts.set(r.product_id, (counts.get(r.product_id) ?? 0) + 1));

  return (
    <section className="flex flex-col gap-6">
      <div>
        <Link href="/products" className="text-sm text-muted hover:underline">{t.back}</Link>
        <div className="mt-3 flex items-center gap-4">
          <BrandLogo name={title ?? t.noBrand} url={logoUrl} size={64} />
          <div>
            <p className="eyebrow">{t.brand}</p>
            <h1 className="text-3xl font-semibold">{title ?? t.noBrand}</h1>
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
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder={t.filterProducts} className="input max-w-sm" />
        <button className="btn-ghost">{t.search}</button>
      </form>
      {products?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((p) => {
            const out = p.stock <= 0;
            const low = !out && p.stock <= p.min_stock;
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
                  <span className={`pill shrink-0 ${out ? "bg-red-100 text-red-700" : low ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {out ? t.outOfStock : low ? t.lowStock : t.inStock}
                  </span>
                </div>
                <div className="mt-auto flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-bold text-navy">{p.stock}<span className="ml-1 text-sm font-medium text-muted">{p.unit}</span></p>
                    <p className="text-xs text-muted">{p.sku || "—"}</p>
                  </div>
                  <span className="pill bg-[#eeeefa] text-navy">📎 {files}</span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="text-muted">{t.noProducts}</p>
      )}
    </section>
  );
}
