import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";

export default async function DocumentsPage() {
  const { lang, t } = await getDictionary();
  const role = await getRole();
  const manager = role === "admin" || role === "manager";
  const supabase = await createClient();
  const date = (d: string) => new Date(d).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB");

  const [{ data: invoices }, { data: quotes }, { data: receipts }] = await Promise.all([
    supabase.from("tax_invoices").select("id, number, invoice_date, customer").order("created_at", { ascending: false }).limit(5),
    manager
      ? supabase.from("quotations").select("id, number, quote_date, customer").order("created_at", { ascending: false }).limit(5)
      : Promise.resolve({ data: null }),
    manager
      ? supabase.from("receipts").select("id, number, receipt_date, customer").order("created_at", { ascending: false }).limit(5)
      : Promise.resolve({ data: null }),
  ]);

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold">{t.documents}</h1>
        <p className="mt-1 text-muted">{t.documentsHelp}</p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="card flex flex-col gap-3">
          <h2 className="text-xl font-semibold">{t.taxInvoices}</h2>
          <p className="text-sm text-muted">{t.docStockLinked}</p>
          <div className="flex gap-2">
            <Link href="/invoices/new" className="btn">{t.newTaxInvoice}</Link>
            <Link href="/invoices" className="btn-ghost">{t.docRecent}</Link>
          </div>
          <ul className="flex flex-col gap-1 text-sm">
            {(invoices ?? []).map((i) => (
              <li key={i.id}>
                <Link href={`/invoices/${i.id}`} className="font-semibold text-navy underline">{i.number}</Link>{" "}
                <span className="text-muted">{date(i.invoice_date)} · {i.customer}</span>
              </li>
            ))}
          </ul>
        </div>

        {[
          { id: "quotations", title: t.quotation, href: "/quotations", create: t.newQuotation, rows: (quotes ?? []).map((q) => ({ id: q.id, number: q.number, d: q.quote_date, customer: q.customer })) },
          { id: "receipts", title: t.receipt, href: "/receipts", create: t.newReceipt, rows: (receipts ?? []).map((r) => ({ id: r.id, number: r.number, d: r.receipt_date, customer: r.customer })) },
        ].map((c) => (
          <div key={c.id} id={c.id} className="card flex scroll-mt-24 flex-col gap-3">
            <h2 className="text-xl font-semibold">{c.title}</h2>
            <p className="text-sm text-muted">{t.docNotStock}</p>
            {manager ? (
              <>
                <div className="flex gap-2">
                  <Link href={`${c.href}/new`} className="btn">{c.create}</Link>
                  <Link href={c.href} className="btn-ghost">{t.docRecent}</Link>
                </div>
                <ul className="flex flex-col gap-1 text-sm">
                  {c.rows.map((r) => (
                    <li key={r.id}>
                      <Link href={`${c.href}/${r.id}`} className="font-semibold text-navy underline">{r.number}</Link>{" "}
                      <span className="text-muted">{date(r.d)} · {r.customer}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-muted">—</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
