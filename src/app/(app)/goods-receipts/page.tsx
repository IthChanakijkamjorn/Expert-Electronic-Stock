import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";

export default async function GoodsReceiptsPage() {
  const { lang, t } = await getDictionary();
  const role = await getRole();
  if (role !== "admin" && role !== "manager") redirect("/");
  const supabase = await createClient();
  const { data: receipts } = await supabase
    .from("goods_receipts")
    .select("id, supplier, reference, received_date, file_path, goods_receipt_lines(qty)")
    .order("received_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  const locale = lang === "th" ? "th-TH" : "en-GB";

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t.goodsReceived}</h1>
        <Link href="/goods-receipts/new" className="btn">{t.newGoodsReceipt}</Link>
      </div>
      <div className="card overflow-x-auto p-4">
        {receipts?.length ? (
          <table className="data-table w-full text-left text-sm">
            <thead>
              <tr>
                <th className="py-2 pr-3">{t.date}</th>
                <th className="pr-3">{t.grSupplier}</th>
                <th className="pr-3">{t.grReference}</th>
                <th className="pr-3 text-right">{t.grItems}</th>
                <th className="text-right">{t.grAttachment}</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id} className="border-t border-zinc-100">
                  <td className="py-2 pr-3">
                    <Link href={`/goods-receipts/${r.id}`} className="font-semibold text-navy underline">
                      {new Date(r.received_date).toLocaleDateString(locale, { timeZone: "Asia/Bangkok" })}
                    </Link>
                  </td>
                  <td className="pr-3">{r.supplier}</td>
                  <td className="pr-3">{r.reference}</td>
                  <td className="pr-3 text-right">{r.goods_receipt_lines.length}</td>
                  <td className="text-right">{r.file_path ? "📎" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted">{t.noItems}</p>
        )}
      </div>
    </section>
  );
}
