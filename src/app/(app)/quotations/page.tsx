import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { RequesterFilter, byRequester } from "@/components/RequesterFilter";
import { DraftList } from "@/components/DraftList";

export default async function QuotationsPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const { r: sel = "" } = await searchParams;
  const role = await getRole();
  if (role !== "admin" && role !== "manager") redirect("/documents");
  const { lang, t } = await getDictionary();
  const supabase = await createClient();
  const { data: all } = await supabase
    .from("quotations").select("id, number, quote_date, customer, project_label, status, updated_at, requester, projects(name)").order("updated_at", { ascending: false }).limit(200);
  const rows = (all ?? []).map((q) => ({ ...q, project: q.project_label ?? (q.projects as unknown as { name: string } | null)?.name ?? "" }));
  const drafts = rows.filter((q) => q.status === "draft");
  const finals = rows.filter((q) => q.status === "final").sort((a, b) => (b.number ?? "").localeCompare(a.number ?? ""));
  const data = byRequester(finals, sel);
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">{t.quotation}</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/quotations/compare" className="btn-ghost">คู่เทียบ</Link>
          <Link href="/quotations/new" className="btn">{t.newQuotation}</Link>
        </div>
      </div>
      <DraftList rows={drafts} base="/quotations" kind="quotations" t={t} lang={lang} />
      <RequesterFilter rows={finals} selected={sel} base="/quotations" t={t} />
      <div className="card overflow-x-auto p-4">
        {data?.length ? (
          <table className="data-table w-full text-left text-sm">
            <thead><tr><th className="py-2 pr-3">{t.invNumber}</th><th className="pr-3">{t.invDate}</th><th className="pr-3">{t.invCustomer}</th><th className="pr-3">โครงการ / Project</th><th className="pr-3">{t.requesterShort}</th><th /></tr></thead>
            <tbody>
              {data.map((q) => (
                <tr key={q.id} className="border-t border-zinc-100">
                  <td className="py-2 pr-3"><Link href={`/quotations/${q.id}`} className="font-semibold text-navy underline">{q.number}</Link></td>
                  <td className="pr-3">{new Date(q.quote_date).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", { timeZone: "Asia/Bangkok" })}</td>
                  <td className="pr-3">{q.customer}</td>
                  <td className="pr-3">{q.project || "—"}</td>
                  <td className="pr-3">{q.requester || "—"}</td>
                  <td><Link href={`/quotations/${q.id}/edit`} className="btn-ghost" title={t.docEdit}>✎</Link> <a href={`/quotations/${q.id}/pdf?download=1`} className="btn-ghost">PDF</a> <a href={`/quotations/${q.id}/xlsx`} className="btn-ghost" title="Download Excel">XLS</a></td>
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
