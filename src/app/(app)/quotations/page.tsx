import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";

export default async function QuotationsPage() {
  const role = await getRole();
  if (role !== "admin" && role !== "manager") redirect("/documents");
  const { lang, t } = await getDictionary();
  const supabase = await createClient();
  const { data } = await supabase
    .from("quotations").select("id, number, quote_date, customer").order("created_at", { ascending: false }).limit(200);
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t.quotation}</h1>
        <Link href="/quotations/new" className="btn">{t.newQuotation}</Link>
      </div>
      <div className="card overflow-x-auto p-4">
        {data?.length ? (
          <table className="data-table w-full text-left text-sm">
            <thead><tr><th className="py-2 pr-3">{t.invNumber}</th><th className="pr-3">{t.invDate}</th><th className="pr-3">{t.invCustomer}</th><th /></tr></thead>
            <tbody>
              {data.map((q) => (
                <tr key={q.id} className="border-t border-zinc-100">
                  <td className="py-2 pr-3"><Link href={`/quotations/${q.id}`} className="font-semibold text-navy underline">{q.number}</Link></td>
                  <td className="pr-3">{new Date(q.quote_date).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB")}</td>
                  <td className="pr-3">{q.customer}</td>
                  <td><a href={`/quotations/${q.id}/pdf`} target="_blank" className="btn-ghost">PDF</a></td>
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
