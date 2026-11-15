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

  const [{ data: invoices }, { data: quotes }] = await Promise.all([
    supabase.from("tax_invoices").select("id, number, invoice_date, customer").order("created_at", { ascending: false }).limit(5),
    manager
      ? supabase
          .from("quotations")
          .select("id, number, created_at, customer, project_id, projects(tower_id, towers(organization_id))")
          .order("created_at", { ascending: false })
          .limit(5)
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

        <div id="quotations" className="card flex scroll-mt-24 flex-col gap-3">
          <h2 className="text-xl font-semibold">{t.quotation}</h2>
          <p className="text-sm text-muted">{t.docNotStock}</p>
          {manager ? (
            <>
              <Link href="/projects" className="btn w-fit">{t.docCreateFromProject}</Link>
              <ul className="flex flex-col gap-1 text-sm">
                {(quotes ?? []).map((q) => {
                  const p = q.projects as unknown as { tower_id: string; towers: { organization_id: string } } | null;
                  return (
                    <li key={q.id}>
                      {p ? (
                        <a
                          href={`/projects/${p.towers.organization_id}/${p.tower_id}/${q.project_id}/quotation/${q.id}`}
                          target="_blank"
                          className="font-semibold text-navy underline"
                        >
                          {q.number}
                        </a>
                      ) : (
                        q.number
                      )}{" "}
                      <span className="text-muted">{date(q.created_at)} · {q.customer}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted">—</p>
          )}
        </div>

        <div id="receipts" className="card flex scroll-mt-24 flex-col gap-3">
          <h2 className="text-xl font-semibold">{t.receipt}</h2>
          <p className="text-sm text-muted">{t.docNotStock}</p>
          <span className="pill w-fit bg-zinc-100 text-zinc-700">{t.receiptSoon}</span>
        </div>
      </div>
    </section>
  );
}
