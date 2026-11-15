import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { PrintButton } from "@/components/PrintButton";

export default async function LabelPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const { t } = await getDictionary();
  const supabase = await createClient();
  const { data: p } = await supabase.from("products").select("id, name, sku, brand").eq("id", productId).maybeSingle();
  if (!p) notFound();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const qr = await QRCode.toDataURL(`${proto}://${host}/products/${p.id}`, { margin: 1, width: 400 });

  return (
    <section className="flex flex-col items-start gap-4">
      <PrintButton label={t.printLabel} />
      <div className="flex w-72 flex-col items-center gap-2 rounded-xl border border-zinc-400 p-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR" width={200} height={200} />
        <p className="font-semibold">{p.name}</p>
        {p.sku && <p className="font-mono text-sm">{p.sku}</p>}
        {p.brand && <p className="text-xs text-muted">{p.brand}</p>}
      </div>
    </section>
  );
}
