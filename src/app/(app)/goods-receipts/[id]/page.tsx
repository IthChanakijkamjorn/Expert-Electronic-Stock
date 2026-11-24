import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { signedUrls } from "@/lib/storage";

export default async function GoodsReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { lang, t } = await getDictionary();
  const role = await getRole();
  if (role !== "admin" && role !== "manager") redirect("/");
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("goods_receipts")
    .select("id, supplier, reference, note, received_date, file_path, file_name, goods_receipt_lines(id, qty, unit_cost, products(name:display_name, model, unit))")
    .eq("id", id)
    .maybeSingle();
  if (!r) notFound();
  const urls = await signedUrls([r.file_path]);
  const fileUrl = r.file_path ? urls.get(r.file_path) : undefined;
  const locale = lang === "th" ? "th-TH" : "en-GB";
  const money = (n: number) => n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <section className="flex flex-col gap-6">
      <div>
        <Link href="/goods-receipts" className="text-sm text-muted hover:underline">{t.back}</Link>
        <p className="eyebrow mt-3">{new Date(r.received_date).toLocaleDateString(locale, { timeZone: "Asia/Bangkok" })}</p>
        <h1 className="page-title">{r.supplier}</h1>
        {r.reference && <p className="mt-1 text-muted">{r.reference}</p>}
        {r.note && <p className="mt-2 text-muted">{r.note}</p>}
        {fileUrl && (
          <a href={fileUrl} target="_blank" rel="noreferrer" className="btn-ghost mt-3 inline-block">
            📎 {r.file_name ?? t.grAttachment}
          </a>
        )}
      </div>
      <div className="card overflow-x-auto p-4">
        <table className="data-table w-full text-left text-sm">
          <thead>
            <tr>
              <th className="py-2 pr-3">{t.product}</th>
              <th className="pr-3 text-right">{t.quantity}</th>
              <th className="text-right">{t.unitCost}</th>
            </tr>
          </thead>
          <tbody>
            {r.goods_receipt_lines.map((l) => {
              const p = l.products as unknown as { name: string; unit: string };
              return (
                <tr key={l.id} className="border-t border-zinc-100">
                  <td className="py-2 pr-3">{p.name}</td>
                  <td className="pr-3 text-right">{l.qty} {p.unit}</td>
                  <td className="text-right">{l.unit_cost === null ? "" : money(Number(l.unit_cost))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
