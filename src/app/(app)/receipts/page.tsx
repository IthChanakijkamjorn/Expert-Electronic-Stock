import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { DraftList } from "@/components/DraftList";
import { money } from "@/lib/quotation";

export default async function ReceiptsPage() {
  const role = await getRole();
  if (role !== "admin" && role !== "manager") redirect("/documents");
  const { lang, t } = await getDictionary();
  const supabase = await createClient();
  const { data: all } = await supabase
    .from("receipts").select("id, number, receipt_date, customer, lines, status, updated_at").order("updated_at", { ascending: false }).limit(200);
  const drafts = (all ?? []).filter((r) => r.status === "draft");
  const data = (all ?? []).filter((r) => r.status === "final");
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t.receipt}</h1>
        <Link href="/receipts/new" className="btn">{t.newReceipt}</Link>
      </div>
      <DraftList rows={drafts} base="/receipts" t={t} lang={lang} />
      <div className="card overflow-x-auto p-4">
        {data?.length ? (
          <table className="data-table w-full text-left text-sm">
            <thead><tr><th className="py-2 pr-3">{t.invNumber}</th><th className="pr-3">{t.invDate}</th><th className="pr-3">{t.invCustomer}</th><th className="pr-3 text-right">{t.invGrandTotal}</th><th /></tr></thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-t border-zinc-100">
                  <td className="py-2 pr-3"><Link href={`/receipts/${r.id}`} className="font-semibold text-navy underline">{r.number}</Link></td>
                  <td className="pr-3">{new Date(r.receipt_date).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB")}</td>
                  <td className="pr-3">{r.customer}</td>
                  <td className="pr-3 text-right">{money((r.lines as { amount: number }[]).reduce((s, l) => s + Number(l.amount), 0))}</td>
                  <td><a href={`/receipts/${r.id}/pdf`} target="_blank" className="btn-ghost">PDF</a></td>
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
